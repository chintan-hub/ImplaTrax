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

/** Invites a team member by email — they get their own Supabase Auth account and set their own password and device PIN on first sign-in, rather than an admin issuing one on their behalf (that model only made sense when every member's data lived in this one browser). */
export function AddMemberDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { addMember } = useAuth()
  const [name, setName] = useState('')
  const [contact, setContact] = useState('')
  const [role, setRole] = useState<AccountRole>('staff')
  const [submitting, setSubmitting] = useState(false)

  const reset = () => {
    setName('')
    setContact('')
    setRole('staff')
  }

  const handleSubmit = async () => {
    if (!name.trim()) {
      toast.error('Name is required.')
      return
    }
    if (!contact.trim()) {
      toast.error('Email is required to invite a team member.')
      return
    }
    setSubmitting(true)
    const result = await addMember({ name, contact, role })
    setSubmitting(false)
    if (!result.ok) {
      toast.error('Could not invite team member', { description: result.error })
      return
    }
    toast.success(`Invitation sent to ${contact}`, { description: `They'll join as ${ROLE_LABEL[role]} once they accept.` })
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
          <DialogTitle>Invite Team Member</DialogTitle>
          <DialogDescription>Sends an invitation to join this workspace with the role you set below.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="member-name">Full name</Label>
            <Input id="member-name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="member-contact">Email</Label>
            <Input id="member-contact" type="email" value={contact} onChange={(e) => setContact(e.target.value)} />
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
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} loading={submitting}>
            Send Invitation
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
