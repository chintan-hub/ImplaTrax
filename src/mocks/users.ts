import type { AppUser, UserRole } from '@/types'
import { iso, daysAgo, ri } from './rng'

const AVATAR_COLORS = ['#3b82f6', '#14b8a6', '#8b5cf6', '#f59e0b', '#22c55e', '#ec4899']

const SEED_USERS: { name: string; email: string; role: UserRole }[] = [
  { name: 'Yash Mehta', email: 'yash@dentocrafts.com', role: 'admin' },
  { name: 'Dr. Alan Whitfield', email: 'alan.whitfield@dentocrafts.com', role: 'clinician' },
  { name: 'Dr. Priya Raman', email: 'priya.raman@dentocrafts.com', role: 'clinician' },
  { name: 'Marcus Fields', email: 'marcus.fields@dentocrafts.com', role: 'inventory-manager' },
  { name: 'Sofia Alvarez', email: 'sofia.alvarez@dentocrafts.com', role: 'front-desk' },
  { name: 'Nathan Cole', email: 'nathan.cole@dentocrafts.com', role: 'clinician' },
  { name: 'Leila Haddad', email: 'leila.haddad@dentocrafts.com', role: 'front-desk' },
  { name: 'Devon Park', email: 'devon.park@dentocrafts.com', role: 'inventory-manager' },
]

// Only consumed by other seed generators (purchaseOrders/sales/loans/
// inventory) to pick a realistic "actor" name for dev/demo history — never
// rendered as a real Users list; see DataContext.tsx's removal of the old
// AppUser-based /users page, superseded by the real Auth workspace_members
// system (Settings > Workspace tab).
export const users: AppUser[] = SEED_USERS.map((u, i) => ({
  id: `usr_${i + 1}`,
  name: u.name,
  email: u.email,
  role: u.role,
  avatarColor: AVATAR_COLORS[i % AVATAR_COLORS.length],
  active: true,
  createdAt: iso(daysAgo(ri(100, 900))),
}))
