import { History } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { EmptyState } from '@/components/shared/EmptyState'
import { formatDateTime } from '@/lib/utils'
import { useAuth } from '@/features/auth/AuthContext'
import type { AuditAction } from '@/features/auth/accountTypes'

const ACTION_LABEL: Record<AuditAction, string> = {
  onboarding_completed: 'Workspace created',
  login: 'Signed in',
  login_failed: 'Incorrect PIN attempt',
  account_locked_out: 'Locked out (too many attempts)',
  logout: 'Signed out',
  lock: 'Locked',
  auto_locked: 'Auto-locked (inactivity)',
  session_timeout: 'Session expired',
  pin_changed: 'PIN changed',
  pin_reset_by_admin: 'PIN reset by admin',
  biometrics_enabled: 'Biometrics enabled',
  biometrics_disabled: 'Biometrics disabled',
  member_added: 'Team member added',
  member_disabled: 'Team member disabled',
  member_reactivated: 'Team member reactivated',
  member_role_changed: 'Role changed',
  member_removed: 'Team member removed',
  workspace_created: 'Workspace created',
  workspace_renamed: 'Workspace renamed',
  workspace_switched: 'Switched workspace',
  profile_updated: 'Profile updated',
}

export function ActivityLogTab() {
  const { auditLog } = useAuth()

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-1.5">
          <History className="h-4 w-4" /> Activity Log
        </CardTitle>
        <CardDescription>A local history of security-relevant events for this workspace, stored only on this device</CardDescription>
      </CardHeader>
      <CardContent>
        {auditLog.length === 0 ? (
          <EmptyState icon={History} title="No activity yet" description="Security events like sign-ins and team changes will appear here." />
        ) : (
          <div className="rounded-xl border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Event</TableHead>
                  <TableHead>By</TableHead>
                  <TableHead>Details</TableHead>
                  <TableHead className="text-right">When</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {auditLog.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell className="font-medium">{ACTION_LABEL[entry.action]}</TableCell>
                    <TableCell className="text-muted-foreground">{entry.actorName}</TableCell>
                    <TableCell className="text-muted-foreground">{entry.detail ?? '—'}</TableCell>
                    <TableCell className="whitespace-nowrap text-right text-muted-foreground">{formatDateTime(entry.at)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
