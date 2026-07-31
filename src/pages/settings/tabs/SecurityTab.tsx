import { useState } from 'react'
import { toast } from 'sonner'
import { Lock, ShieldAlert } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { useAuth } from '@/features/auth/AuthContext'

const AUTO_LOCK_OPTIONS = [
  { value: '1', label: 'After 1 minute' },
  { value: '5', label: 'After 5 minutes' },
  { value: '15', label: 'After 15 minutes' },
  { value: '30', label: 'After 30 minutes' },
  { value: '0', label: 'Never' },
]

const SESSION_TIMEOUT_OPTIONS = [
  { value: '60', label: '1 hour' },
  { value: '240', label: '4 hours' },
  { value: '720', label: '12 hours' },
  { value: '1440', label: '24 hours' },
  { value: '0', label: 'Never' },
]

export function SecurityTab() {
  const { security, setAutoLockMinutes, setSessionTimeoutMinutes, setDesktopNotifications, lock, resetDevice, failedPinAttempts } = useAuth()
  const [resetOpen, setResetOpen] = useState(false)

  const handleLockNow = () => {
    lock()
    toast.success('ImplaTrax locked')
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Auto-Lock</CardTitle>
          <CardDescription>Automatically lock ImplaTrax after a period of inactivity</CardDescription>
        </CardHeader>
        <CardContent className="max-w-xs space-y-1.5">
          <Select value={String(security.autoLockMinutes)} onValueChange={(v) => setAutoLockMinutes(Number(v))}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {AUTO_LOCK_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Session Timeout</CardTitle>
          <CardDescription>Require your PIN again after this much time, even if you're active</CardDescription>
        </CardHeader>
        <CardContent className="max-w-xs space-y-1.5">
          <Select value={String(security.sessionTimeoutMinutes)} onValueChange={(v) => setSessionTimeoutMinutes(Number(v))}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SESSION_TIMEOUT_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>PIN Protection</CardTitle>
          <CardDescription>Repeated incorrect attempts temporarily lock this device</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            After <strong className="text-foreground">{security.maxPinAttempts}</strong> incorrect attempts, PIN entry is disabled for{' '}
            <strong className="text-foreground">{security.lockoutMinutes} minute(s)</strong>.
            {failedPinAttempts > 0 && <> Currently {failedPinAttempts} recent incorrect attempt(s) on this account.</>}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Notifications</CardTitle>
          <CardDescription>Local security alerts, shown on this device only</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between rounded-lg border border-border p-3">
            <div>
              <p className="text-sm font-medium">Desktop notifications</p>
              <p className="text-xs text-muted-foreground">Get notified of lockouts and security events on this device.</p>
            </div>
            <Switch checked={security.desktopNotifications} onCheckedChange={setDesktopNotifications} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-1.5">
            <Lock className="h-4 w-4" /> Lock App
          </CardTitle>
          <CardDescription>Immediately require your PIN again</CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="outline" onClick={handleLockNow}>
            Lock Now
          </Button>
        </CardContent>
      </Card>

      <Card className="border-danger/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-1.5 text-danger-700 dark:text-danger-500">
            <ShieldAlert className="h-4 w-4" /> Danger Zone
          </CardTitle>
          <CardDescription>Forgot your PIN entirely? Reset this device and set it up again.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="destructive" onClick={() => setResetOpen(true)}>
            Reset This Device
          </Button>
        </CardContent>
      </Card>

      <ConfirmDialog
        open={resetOpen}
        onOpenChange={setResetOpen}
        title="Reset this device?"
        description="You'll need to set up your workspace and PIN again. Your existing inventory data is stored separately and will not be affected."
        confirmLabel="Reset device"
        tone="destructive"
        onConfirm={resetDevice}
      />
    </div>
  )
}
