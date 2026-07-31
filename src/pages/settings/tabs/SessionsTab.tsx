import { Monitor, LogOut } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { formatDateTime } from '@/lib/utils'
import { useAuth } from '@/features/auth/AuthContext'

function detectDeviceLabel(): string {
  const ua = navigator.userAgent
  const platform = /Windows/.test(ua) ? 'Windows' : /Mac OS/.test(ua) ? 'Mac' : /Android/.test(ua) ? 'Android' : /iPhone|iPad/.test(ua) ? 'iOS' : /Linux/.test(ua) ? 'Linux' : 'Unknown device'
  const browser = /Edg\//.test(ua) ? 'Edge' : /Chrome\//.test(ua) ? 'Chrome' : /Firefox\//.test(ua) ? 'Firefox' : /Safari\//.test(ua) ? 'Safari' : 'Browser'
  return `${browser} on ${platform}`
}

export function SessionsTab() {
  const { currentMember, deviceId } = useAuth()

  if (!currentMember) return null

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-1.5">
            <Monitor className="h-4 w-4" /> Active Sessions
          </CardTitle>
          <CardDescription>ImplaTrax runs entirely on this device — there's no server tracking sessions elsewhere</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between rounded-lg border border-border p-3">
            <div>
              <div className="flex items-center gap-1.5 text-sm font-medium">
                <span>{detectDeviceLabel()}</span>
                <Badge>This device</Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                Signed in as {currentMember.name} · Last active {currentMember.lastActiveAt ? formatDateTime(currentMember.lastActiveAt) : 'just now'}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground/70">Device ID: {deviceId.slice(0, 8)}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="opacity-70">
        <CardHeader>
          <CardTitle className="flex items-center gap-1.5">
            <LogOut className="h-4 w-4" /> Log Out All Devices
          </CardTitle>
          <CardDescription>Sign out of ImplaTrax everywhere at once</CardDescription>
        </CardHeader>
        <CardContent>
          <Button disabled variant="outline">
            Log Out All Devices
          </Button>
          <p className="mt-2 text-xs text-muted-foreground">This feature requires Cloud Workspace and will be available in a future release.</p>
        </CardContent>
      </Card>
    </div>
  )
}
