import { useState } from 'react'
import { toast } from 'sonner'
import { Plus, ShieldCheck, Download } from 'lucide-react'
import { PageHeader } from '@/components/shared/PageHeader'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { UserFormDialog } from '@/components/users/UserFormDialog'
import { useData } from '@/store/DataContext'
import { formatDate, initials } from '@/lib/utils'
import { exportToCsv } from '@/lib/documents/csv'
import { PAGE_INTROS } from '@/content/helpText'
import type { UserRole } from '@/types'

const ROLES: UserRole[] = ['admin', 'clinician', 'inventory-manager', 'front-desk']

const ROLE_LABEL: Record<UserRole, string> = {
  admin: 'Admin',
  clinician: 'Clinician',
  'inventory-manager': 'Inventory Manager',
  'front-desk': 'Front Desk',
}

const ROLE_VARIANT: Record<UserRole, 'default' | 'accent' | 'success' | 'secondary'> = {
  admin: 'default',
  clinician: 'accent',
  'inventory-manager': 'success',
  'front-desk': 'secondary',
}

const PERMISSIONS: { area: string; admin: boolean; clinician: boolean; inventoryManager: boolean; frontDesk: boolean }[] = [
  { area: 'View inventory & products', admin: true, clinician: true, inventoryManager: true, frontDesk: true },
  { area: 'Adjust stock / receive POs', admin: true, clinician: false, inventoryManager: true, frontDesk: false },
  { area: 'Issue & return loans', admin: true, clinician: false, inventoryManager: true, frontDesk: false },
  { area: 'View pricing & costs', admin: true, clinician: true, inventoryManager: true, frontDesk: false },
  { area: 'Manage patients & cases', admin: true, clinician: true, inventoryManager: false, frontDesk: true },
  { area: 'Manage users & settings', admin: true, clinician: false, inventoryManager: false, frontDesk: false },
]

export function UsersPage() {
  const { users, updateUserRole, setUserActive } = useData()
  const [formOpen, setFormOpen] = useState(false)

  const handleRoleChange = (userId: string, name: string, role: UserRole) => {
    updateUserRole(userId, role)
    toast.success(`${name}'s role updated to ${ROLE_LABEL[role]}`)
  }

  const handleActiveToggle = (userId: string, name: string, active: boolean) => {
    setUserActive(userId, active)
    toast.success(`${name} is now ${active ? 'active' : 'inactive'}`)
  }

  const handleExportCsv = () => {
    const rows = users.map((u) => ({
      Name: u.name,
      Email: u.email,
      Role: ROLE_LABEL[u.role],
      Status: u.active ? 'Active' : 'Inactive',
      Joined: formatDate(u.createdAt),
    }))
    exportToCsv(rows, `users-${new Date().toISOString().slice(0, 10)}.csv`)
  }

  return (
    <div>
      <PageHeader
        title={PAGE_INTROS.users.title}
        description={`${PAGE_INTROS.users.description} ${users.length} team members with access.`}
        actions={
          <>
            <Button variant="outline" onClick={handleExportCsv} disabled={users.length === 0}>
              <Download className="h-4 w-4" /> Export CSV
            </Button>
            <Button onClick={() => setFormOpen(true)}>
              <Plus className="h-4 w-4" /> Add User
            </Button>
          </>
        }
      />

      <div className="rounded-xl border border-border bg-card mb-6">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>User</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Joined</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((u) => (
              <TableRow key={u.id}>
                <TableCell>
                  <div className="flex items-center gap-2.5">
                    <Avatar className="h-8 w-8">
                      <AvatarFallback style={{ backgroundColor: u.avatarColor, color: 'white' }} className="text-xs">{initials(u.name)}</AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium">{u.name}</p>
                      <p className="text-xs text-muted-foreground">{u.email}</p>
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <Select value={u.role} onValueChange={(v) => handleRoleChange(u.id, u.name, v as UserRole)}>
                    <SelectTrigger className="h-8 w-44">
                      <SelectValue>
                        <Badge variant={ROLE_VARIANT[u.role]}>{ROLE_LABEL[u.role]}</Badge>
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {ROLES.map((r) => <SelectItem key={r} value={r}>{ROLE_LABEL[r]}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Switch checked={u.active} onCheckedChange={(v) => handleActiveToggle(u.id, u.name, v)} aria-label={`Toggle ${u.name} active status`} />
                    <Badge variant={u.active ? 'success' : 'secondary'}>{u.active ? 'Active' : 'Inactive'}</Badge>
                  </div>
                </TableCell>
                <TableCell className="text-muted-foreground whitespace-nowrap">{formatDate(u.createdAt)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><ShieldCheck className="h-4 w-4" /> Role Permissions</CardTitle>
          <CardDescription>What each role can access across ImplantDesk</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Area</TableHead>
                <TableHead className="text-center">Admin</TableHead>
                <TableHead className="text-center">Clinician</TableHead>
                <TableHead className="text-center">Inventory Mgr</TableHead>
                <TableHead className="text-center">Front Desk</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {PERMISSIONS.map((row) => (
                <TableRow key={row.area}>
                  <TableCell className="font-medium">{row.area}</TableCell>
                  {[row.admin, row.clinician, row.inventoryManager, row.frontDesk].map((allowed, i) => (
                    <TableCell key={i} className="text-center">
                      <span className={allowed ? 'text-success-600' : 'text-muted-foreground/40'}>{allowed ? '●' : '—'}</span>
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <UserFormDialog open={formOpen} onOpenChange={setFormOpen} />
    </div>
  )
}
