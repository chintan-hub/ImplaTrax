import { useState } from 'react'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import { useAuth } from '../AuthContext'
import { ACCOUNT_ROLES, type AccountRole } from '../accountTypes'
import { ROLE_LABEL } from '../roles'

/** Adds a team member directly on this device — the honest local alternative to a cross-device "invite by link," which this build doesn't fake (see the disabled Invite card in WorkspaceTab). The admin sets the new member's starting PIN themselves; they can change it once signed in. */
export function AddMemberDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { addMember } = useAuth()
  const [name, setName] = useState('')
  const [contact, setContact] = useState('')
  const [role, setRole] = useState<AccountRole>('staff')
  const [pin, setPin] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const reset = () => {
    setName('')
    setContact('')
    setRole('staff')
    setPin('')
  }

  const handleSubmit = async () => {
    if (!name.trim()) {
      toast.error('Name is required.')
      return
    }
    if (!/^\d{4}$/.test(pin)) {
      toast.error('Starting PIN must be exactly 4 digits.')
      return
    }
    setSubmitting(true)
    const result = await addMember({ name, contact, role, pin })
    setSubmitting(false)
    if (!result.ok) {
      toast.error('Could not add team member', { description: result.error })
      return
    }
    toast.success(`${name} added`, { description: `They can sign in with the PIN you set, as ${ROLE_LABEL[role]}.` })
    reset()
    onOpenChange(false)
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) reset()
        onOpenChange(v)
      }}
    >
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Add Team Member</DialogTitle>
          <DialogDescription>Added directly to this workspace on this device, with the role and starting PIN you set below.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="member-name">Full name</Label>
            <Input id="member-name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="member-contact">Mobile or email (optional)</Label>
            <Input id="member-contact" value={contact} onChange={(e) => setContact(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Role</Label>
            <Select value={role} onValueChange={(v) => setRole(v as AccountRole)}>
              <SelectTrigger>
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
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="member-pin">Starting PIN (4 digits)</Label>
            <Input
              id="member-pin"
              type="password"
              inputMode="numeric"
              autoComplete="off"
              maxLength={4}
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
            />
            <p className="text-xs text-muted-foreground">Share this PIN with them directly — they can change it from Settings once signed in.</p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} loading={submitting}>
            Add Member
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
