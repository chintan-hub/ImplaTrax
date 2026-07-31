import type { AccountRole } from './accountTypes'

/** Display labels and badge colors for workspace-membership roles — shared between the lock screen's account picker and the Settings → Workspace team table. */
export const ROLE_LABEL: Record<AccountRole, string> = {
  owner: 'Owner',
  'super-admin': 'Super Admin',
  admin: 'Admin',
  manager: 'Manager',
  staff: 'Staff',
  'read-only': 'Read Only',
}

export const ROLE_BADGE_VARIANT: Record<AccountRole, 'default' | 'accent' | 'success' | 'secondary' | 'warning'> = {
  owner: 'default',
  'super-admin': 'accent',
  admin: 'success',
  manager: 'secondary',
  staff: 'secondary',
  'read-only': 'warning',
}

export const ROLE_DESCRIPTION: Record<AccountRole, string> = {
  owner: 'Full control of this workspace, including billing-equivalent and security settings. Cannot be removed while they are the only owner.',
  'super-admin': 'Can manage team members, roles, and workspace security settings.',
  admin: 'Can manage team members and workspace settings, but cannot change another owner.',
  manager: 'Can manage day-to-day operations. Cannot manage team members or security settings.',
  staff: 'Standard access for daily work. Cannot manage team members or settings.',
  'read-only': 'Can view data but cannot create, edit, or delete anything.',
}
