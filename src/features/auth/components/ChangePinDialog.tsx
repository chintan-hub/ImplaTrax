import { useState } from 'react'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAuth } from '../AuthContext'

function pinInputProps(value: string, onChange: (v: string) => void) {
  return {
    type: 'password' as const,
    inputMode: 'numeric' as const,
    autoComplete: 'off',
    maxLength: 4,
    value,
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => onChange(e.target.value.replace(/\D/g, '').slice(0, 4)),
  }
}

/** Authenticated PIN change from Settings — a plain form dialog (not the lock screen's keypad), since this is a settings action, not the approved auth-screen visual language. */
export function ChangePinDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { changePin } = useAuth()
  const [oldPin, setOldPin] = useState('')
  const [newPin, setNewPin] = useState('')
  const [confirmPin, setConfirmPin] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const reset = () => {
    setOldPin('')
    setNewPin('')
    setConfirmPin('')
  }

  const handleSubmit = async () => {
    if (oldPin.length !== 4 || newPin.length !== 4 || confirmPin.length !== 4) {
      toast.error('Enter all three 4-digit PINs.')
      return
    }
    if (newPin !== confirmPin) {
      toast.error("New PINs don't match.")
      return
    }
    if (newPin === oldPin) {
      toast.error('Choose a PIN different from your current one.')
      return
    }
    setSubmitting(true)
    const ok = await changePin(oldPin, newPin)
    setSubmitting(false)
    if (!ok) {
      toast.error('Current PIN is incorrect.')
      return
    }
    toast.success('PIN changed', { description: 'Use your new PIN next time you unlock ImplaTrax.' })
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
          <DialogTitle>Change PIN</DialogTitle>
          <DialogDescription>Enter your current PIN, then choose a new one.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="old-pin">Current PIN</Label>
            <Input id="old-pin" {...pinInputProps(oldPin, setOldPin)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="new-pin">New PIN</Label>
            <Input id="new-pin" {...pinInputProps(newPin, setNewPin)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="confirm-pin">Confirm new PIN</Label>
            <Input id="confirm-pin" {...pinInputProps(confirmPin, setConfirmPin)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} loading={submitting}>
            Change PIN
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
