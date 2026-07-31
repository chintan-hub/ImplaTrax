import { useState } from 'react'
import { toast } from 'sonner'
import { Fingerprint } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { simulateLatency, initials } from '@/lib/utils'
import { useAuth } from '@/features/auth/AuthContext'
import { ROLE_LABEL } from '@/features/auth/roles'
import { ChangePinDialog } from '@/features/auth/components/ChangePinDialog'

export function ProfileTab() {
  const { currentMember, updateProfile, hasBiometrics, platformAuthAvailable, enableBiometrics, disableBiometrics } = useAuth()
  const [name, setName] = useState(currentMember?.name ?? '')
  const [contact, setContact] = useState(currentMember?.contact ?? '')
  const [saving, setSaving] = useState(false)
  const [pinDialogOpen, setPinDialogOpen] = useState(false)
  const [biometricsBusy, setBiometricsBusy] = useState(false)

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error('Name is required.')
      return
    }
    setSaving(true)
    await simulateLatency()
    updateProfile(name.trim(), contact.trim())
    toast.success('Profile updated')
    setSaving(false)
  }

  const handleBiometricsToggle = async (checked: boolean) => {
    setBiometricsBusy(true)
    if (checked) {
      const ok = await enableBiometrics()
      if (ok) toast.success('Biometrics enabled', { description: 'You can now unlock ImplaTrax with Face ID, Touch ID, or Windows Hello.' })
      else toast.error('Could not enroll biometrics', { description: 'Your device may not support it, or the prompt was cancelled.' })
    } else {
      disableBiometrics()
      toast.success('Biometrics disabled')
    }
    setBiometricsBusy(false)
  }

  if (!currentMember) return null

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Your Profile</CardTitle>
          <CardDescription>How you appear across this workspace</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3">
            <Avatar className="h-12 w-12">
              <AvatarFallback>{initials(currentMember.name)}</AvatarFallback>
            </Avatar>
            <div>
              <p className="font-medium text-foreground">{currentMember.name}</p>
              <Badge variant="default">{ROLE_LABEL[currentMember.role]}</Badge>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="profile-name">Full name</Label>
              <Input id="profile-name" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="profile-contact">Mobile or email</Label>
              <Input id="profile-contact" value={contact} onChange={(e) => setContact(e.target.value)} />
            </div>
          </div>
          <div className="flex justify-end">
            <Button onClick={handleSave} loading={saving}>
              Save Changes
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>PIN</CardTitle>
          <CardDescription>Your 4-digit PIN unlocks ImplaTrax on this device</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between rounded-lg border border-border p-3">
            <div>
              <p className="text-sm font-medium">Change your PIN</p>
              <p className="text-xs text-muted-foreground">You'll need your current PIN to set a new one.</p>
            </div>
            <Button variant="outline" onClick={() => setPinDialogOpen(true)}>
              Change PIN
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-1.5">
            <Fingerprint className="h-4 w-4" /> Biometric Unlock
          </CardTitle>
          <CardDescription>Use Face ID, Touch ID, or Windows Hello instead of typing your PIN</CardDescription>
        </CardHeader>
        <CardContent>
          {platformAuthAvailable ? (
            <div className="flex items-center justify-between rounded-lg border border-border p-3">
              <div>
                <p className="text-sm font-medium">{hasBiometrics ? 'Enabled on this device' : 'Not enabled'}</p>
                <p className="text-xs text-muted-foreground">Only ever used to unlock this device — never leaves it.</p>
              </div>
              <Button variant={hasBiometrics ? 'outline' : 'default'} onClick={() => handleBiometricsToggle(!hasBiometrics)} loading={biometricsBusy}>
                {hasBiometrics ? 'Disable' : 'Enable'}
              </Button>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Biometric unlock isn't available on this device or browser.</p>
          )}
        </CardContent>
      </Card>

      <ChangePinDialog open={pinDialogOpen} onOpenChange={setPinDialogOpen} />
    </div>
  )
}
