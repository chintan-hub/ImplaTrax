import { useCallback, useRef, useState } from 'react'
import { toast } from 'sonner'
import { Plus, Link2, Users as UsersIcon, Building2, Image as ImageIcon, X, AlertTriangle } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { formatDate, initials } from '@/lib/utils'
import { useAuth, type ActionResult } from '@/features/auth/AuthContext'
import { useData } from '@/store/DataContext'
import { AccessDenied } from '@/features/auth/AccessDenied'
import { AddMemberDialog } from '@/features/auth/components/AddMemberDialog'
import { ACCOUNT_ROLES, WORKSPACE_MANAGER_ROLES, type AccountRole } from '@/features/auth/accountTypes'
import { ROLE_LABEL, ROLE_BADGE_VARIANT } from '@/features/auth/roles'
import { useDirtyState } from '@/hooks/useDirtyState'
import { fileToResizedDataUrl } from '@/lib/imageResize'
import { useRegisterSettingsSaveAction } from '../SettingsHeaderActionContext'

/**
 * Logo upload is saved immediately on change (not deferred to the tab's
 * dirty-state Save bar) — a logo is a discrete asset swap, not a form field
 * you'd want to accidentally discard by navigating away, and every other
 * consumer (Sidebar, DocumentLayout) reads it straight from
 * `clinicSettings.logoDataUrl` so it needs to be live immediately.
 */
function WorkspaceLogoCard() {
  const { clinicSettings, updateClinicSettings } = useData()
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const hasLogo = Boolean(clinicSettings.logoDataUrl)

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setUploading(true)
    try {
      const dataUrl = await fileToResizedDataUrl(file)
      updateClinicSettings({ logoDataUrl: dataUrl })
      toast.success('Workspace logo updated', { description: 'Now shown across the app and on new documents.' })
    } catch {
      toast.error('Could not use that image', { description: 'Try a different file.' })
    } finally {
      setUploading(false)
    }
  }

  const handleRemove = () => {
    updateClinicSettings({ logoDataUrl: '' })
    toast.success('Workspace logo removed', { description: 'Your workspace name will be used instead.' })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-1.5">
          <ImageIcon className="h-4 w-4" /> Workspace Logo
        </CardTitle>
        <CardDescription>Appears as the primary brand on invoices, challans, and reports you export or print</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
          <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-border bg-muted/40 dark:bg-black/20">
            {hasLogo ? (
              <img src={clinicSettings.logoDataUrl} alt="Workspace logo" className="h-full w-full object-contain p-1.5" />
            ) : (
              <Building2 className="h-8 w-8 text-muted-foreground/60" aria-hidden="true" />
            )}
          </div>
          <div className="flex flex-1 flex-col gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} loading={uploading}>
                {hasLogo ? 'Change Logo' : 'Upload Logo'}
              </Button>
              {hasLogo && (
                <Button variant="ghost" size="sm" className="text-danger-700 dark:text-danger-500" onClick={handleRemove}>
                  <X className="h-4 w-4" /> Remove
                </Button>
              )}
              <input ref={fileInputRef} type="file" accept="image/*" className="sr-only" onChange={handleFileChange} />
            </div>
            <p className="text-xs text-muted-foreground">PNG or JPG, square works best. Optional — falls back to your workspace name if none is set.</p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export function WorkspaceTab() {
  const {
    currentMember,
    currentWorkspace,
    workspaces,
    workspaceMembers,
    renameWorkspace,
    disableMember,
    reactivateMember,
    changeMemberRole,
    removeMember,
    resetMemberPin,
    createWorkspace,
    switchWorkspace,
  } = useAuth()
  const { wipeWorkspaceData } = useData()

  const [addOpen, setAddOpen] = useState(false)
  const [workspaceName, setWorkspaceName] = useState(currentWorkspace?.name ?? '')
  const [savingName, setSavingName] = useState(false)
  const canManage = Boolean(currentMember && WORKSPACE_MANAGER_ROLES.includes(currentMember.role))
  const nameDirty = useDirtyState(currentWorkspace?.name ?? '', workspaceName.trim())
  const isNameDirty = canManage && nameDirty
  const [removeTarget, setRemoveTarget] = useState<string | null>(null)
  const [newWorkspaceOpen, setNewWorkspaceOpen] = useState(false)
  const [newWorkspaceName, setNewWorkspaceName] = useState('')
  const [creatingWorkspace, setCreatingWorkspace] = useState(false)
  const [wipeOpen, setWipeOpen] = useState(false)
  const [wipeConfirmText, setWipeConfirmText] = useState('')
  const [wiping, setWiping] = useState(false)

  const handleSaveName = useCallback(async () => {
    if (!workspaceName.trim()) {
      toast.error('Workspace name is required.')
      return
    }
    setSavingName(true)
    await renameWorkspace(workspaceName)
    toast.success('Workspace renamed')
    setSavingName(false)
  }, [workspaceName, renameWorkspace])

  useRegisterSettingsSaveAction({ isDirty: isNameDirty, saving: savingName, onSave: handleSaveName })

  if (!currentMember || !currentWorkspace) return null
  if (!canManage) return <AccessDenied message="Only workspace Owners, Super Admins, and Admins can manage team members and workspace settings." />

  const handleAction = async (resultOrPromise: ActionResult | Promise<ActionResult>, successMessage: string) => {
    const result = await resultOrPromise
    if (result.ok) toast.success(successMessage)
    else toast.error('Action failed', { description: result.error })
  }

  const handleCreateWorkspace = async () => {
    if (!newWorkspaceName.trim()) {
      toast.error('Workspace name is required.')
      return
    }
    setCreatingWorkspace(true)
    const result = await createWorkspace(newWorkspaceName)
    setCreatingWorkspace(false)
    if (!result.ok) {
      toast.error('Could not create workspace', { description: result.error })
      return
    }
    toast.success('Workspace created', { description: "You'll set a PIN for it now." })
    setNewWorkspaceName('')
    setNewWorkspaceOpen(false)
  }

  const handleWipeData = async () => {
    setWiping(true)
    try {
      await wipeWorkspaceData()
      toast.success('Workspace data wiped', { description: 'Sales, patients, cases, products, and everything else business-related has been cleared.' })
      setWipeConfirmText('')
      setWipeOpen(false)
    } catch (err) {
      toast.error('Could not wipe workspace data', { description: err instanceof Error ? err.message : undefined })
    } finally {
      setWiping(false)
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-1.5">
            <Building2 className="h-4 w-4" /> Workspace Name
          </CardTitle>
          <CardDescription>Shown throughout ImplaTrax and in exported documents</CardDescription>
        </CardHeader>
        <CardContent className="max-w-md space-y-1.5">
          <Label htmlFor="workspace-name">Name</Label>
          <Input id="workspace-name" value={workspaceName} onChange={(e) => setWorkspaceName(e.target.value)} />
        </CardContent>
      </Card>

      <WorkspaceLogoCard />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-1.5">
            <UsersIcon className="h-4 w-4" /> Team Members
          </CardTitle>
          <CardDescription>People with access to this workspace on this device</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-4 flex justify-end">
            <Button onClick={() => setAddOpen(true)}>
              <Plus className="h-4 w-4" /> Add Team Member
            </Button>
          </div>
          <div className="rounded-xl border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Member</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Last Login</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {workspaceMembers.map((member) => (
                  <TableRow key={member.id}>
                    <TableCell>
                      <div className="flex items-center gap-2.5">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback className="text-xs">{initials(member.name)}</AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium">
                            {member.name} {member.id === currentMember.id && <span className="text-xs text-muted-foreground">(you)</span>}
                          </p>
                          {member.contact && <p className="text-xs text-muted-foreground">{member.contact}</p>}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {member.id === currentMember.id || member.role === 'owner' ? (
                        <Badge variant={ROLE_BADGE_VARIANT[member.role]}>{ROLE_LABEL[member.role]}</Badge>
                      ) : (
                        <Select value={member.role} onValueChange={(v) => handleAction(changeMemberRole(member.id, v as AccountRole), 'Role updated')}>
                          <SelectTrigger className="h-8 w-36">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {ACCOUNT_ROLES.filter((r) => r !== 'owner').map((r) => (
                              <SelectItem key={r} value={r}>
                                {ROLE_LABEL[r]}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={member.status === 'active' ? 'success' : 'secondary'}>{member.status === 'active' ? 'Active' : 'Disabled'}</Badge>
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-muted-foreground">{member.lastLoginAt ? formatDate(member.lastLoginAt) : 'Never'}</TableCell>
                    <TableCell className="text-right">
                      {member.id === currentMember.id ? (
                        <span className="text-xs text-muted-foreground">—</span>
                      ) : (
                        <div className="flex justify-end gap-1.5">
                          <Button variant="ghost" size="sm" onClick={() => handleAction(resetMemberPin(member.id), 'PIN reset — they must set a new one at next login')}>
                            Reset PIN
                          </Button>
                          {member.status === 'active' ? (
                            <Button variant="ghost" size="sm" onClick={() => handleAction(disableMember(member.id), 'Member disabled')}>
                              Disable
                            </Button>
                          ) : (
                            <Button variant="ghost" size="sm" onClick={() => handleAction(reactivateMember(member.id), 'Member reactivated')}>
                              Reactivate
                            </Button>
                          )}
                          <Button variant="ghost" size="sm" className="text-danger-700 dark:text-danger-500" onClick={() => setRemoveTarget(member.id)}>
                            Remove
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Card className="opacity-70">
        <CardHeader>
          <CardTitle className="flex items-center gap-1.5">
            <Link2 className="h-4 w-4" /> Invite via Link
          </CardTitle>
          <CardDescription>Generate a shareable invite for someone to join on their own device</CardDescription>
        </CardHeader>
        <CardContent>
          <Button disabled variant="outline">
            Generate Invite Link
          </Button>
          <p className="mt-2 text-xs text-muted-foreground">This feature requires Cloud Workspace and will be available in a future release.</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Your Workspaces</CardTitle>
          <CardDescription>Workspaces created on this device — each has its own team and PIN, but shares the same inventory data on this device</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {workspaces.map((w) => (
              <div key={w.id} className="flex items-center justify-between rounded-lg border border-border p-3">
                <div>
                  <div className="flex items-center gap-1.5 text-sm font-medium">
                    <span>{w.name}</span>
                    {w.id === currentWorkspace.id && <Badge>Current</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground">Created {formatDate(w.createdAt)}</p>
                </div>
                {w.id !== currentWorkspace.id && (
                  <Button variant="outline" size="sm" onClick={() => switchWorkspace(w.id)}>
                    Switch to This Workspace
                  </Button>
                )}
              </div>
            ))}
          </div>
          <div className="mt-4">
            <Button variant="outline" onClick={() => setNewWorkspaceOpen(true)}>
              <Plus className="h-4 w-4" /> Create Another Workspace
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="opacity-70">
        <CardHeader>
          <CardTitle>Connected Accounts</CardTitle>
          <CardDescription>Sign in with Google, Microsoft, or Apple</CardDescription>
        </CardHeader>
        <CardContent>
          <Button disabled variant="outline">
            Connect an Account
          </Button>
          <p className="mt-2 text-xs text-muted-foreground">This feature requires Cloud Workspace and will be available in a future release.</p>
        </CardContent>
      </Card>

      <Card className="border-danger/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-1.5 text-danger-700 dark:text-danger-500">
            <AlertTriangle className="h-4 w-4" /> Danger Zone
          </CardTitle>
          <CardDescription>Permanently clear this workspace's business data — products, vendors, patients, cases, sales, loans, and purchase orders</CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="destructive" onClick={() => setWipeOpen(true)}>
            Wipe / Reset Data
          </Button>
          <p className="mt-2 text-xs text-muted-foreground">
            The workspace itself, your team, and your settings are kept — only business records are cleared. This cannot be undone.
          </p>
        </CardContent>
      </Card>

      <AddMemberDialog open={addOpen} onOpenChange={setAddOpen} />

      <Dialog open={newWorkspaceOpen} onOpenChange={setNewWorkspaceOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Create Workspace</DialogTitle>
            <DialogDescription>You'll switch into it and set a PIN right away.</DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="new-workspace-name">Workspace name</Label>
            <Input id="new-workspace-name" value={newWorkspaceName} onChange={(e) => setNewWorkspaceName(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewWorkspaceOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateWorkspace} loading={creatingWorkspace}>
              Create & Switch
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={wipeOpen}
        onOpenChange={(v) => {
          if (!v) setWipeConfirmText('')
          setWipeOpen(v)
        }}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-danger-700 dark:text-danger-500">Wipe workspace data?</DialogTitle>
            <DialogDescription>
              This permanently deletes every product, vendor, patient, case, sale, loan, and purchase order in <strong>{currentWorkspace.name}</strong>. Your team,
              workspace settings, and activity log are kept. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="wipe-confirm">
              Type <strong>{currentWorkspace.name}</strong> to confirm
            </Label>
            <Input id="wipe-confirm" value={wipeConfirmText} onChange={(e) => setWipeConfirmText(e.target.value)} autoComplete="off" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setWipeOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" disabled={wipeConfirmText !== currentWorkspace.name} loading={wiping} onClick={handleWipeData}>
              Wipe Data
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={removeTarget != null}
        onOpenChange={(v) => !v && setRemoveTarget(null)}
        title="Remove this team member?"
        description="They will lose access to this workspace immediately. This cannot be undone."
        confirmLabel="Remove"
        tone="destructive"
        onConfirm={() => {
          if (removeTarget) handleAction(removeMember(removeTarget), 'Member removed')
          setRemoveTarget(null)
        }}
      />
    </div>
  )
}
