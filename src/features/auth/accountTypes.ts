/**
 * Types for the local account/workspace layer built on top of the original
 * single-user PIN gate. Everything here is 100% client-side — there is no
 * backend, so "workspace," "member," and "session" all mean "records this
 * one browser's localStorage knows about," not a real multi-tenant system.
 * Features that would need a server to be honest (cross-device invites,
 * signing out other devices, cloud backup) are intentionally NOT modeled
 * as if they worked — see AuthContext.tsx and the Settings pages for where
 * those are surfaced instead as disabled, clearly-labeled "Requires Cloud
 * Workspace" affordances.
 */

/** Workspace-membership tier — distinct from DataContext's business-permission `UserRole` (admin/clinician/inventory-manager/front-desk), which governs a completely separate concern (product/patient/case CRUD) and is untouched by this feature. */
export type AccountRole = 'owner' | 'super-admin' | 'admin' | 'manager' | 'staff' | 'read-only'

export const ACCOUNT_ROLES: AccountRole[] = ['owner', 'super-admin', 'admin', 'manager', 'staff', 'read-only']

/** Roles allowed to manage workspace security/team settings — everything below `admin` is a member, not a manager of the workspace itself. */
export const WORKSPACE_MANAGER_ROLES: AccountRole[] = ['owner', 'super-admin', 'admin']

export interface MemberRecord {
  id: string
  name: string
  contact: string
  role: AccountRole
  status: 'active' | 'disabled'
  pinHash: string | null
  pinSalt: string | null
  /** Account-level credential (prep for Supabase auth) — set at workspace creation, used by "Log In" on a device that doesn't already have a PIN for this member. Members invited via "Add Team Member" have no password; an admin issues their PIN directly instead. */
  passwordHash: string | null
  passwordSalt: string | null
  /** Which device's localStorage this PIN was created for. A PIN is only ever valid on the device it was set up on — on any other device (once Supabase can actually tell them apart), the member must re-verify with their password and set a new PIN there. */
  pinDeviceId: string | null
  webauthnCredentialId: string | null
  /** Set true by an admin-triggered "reset this user's PIN" (or by logging in via password on a device with no matching PIN yet) — forces a Create-PIN step on next unlock before granting access. */
  mustChangePin: boolean
  createdAt: string
  lastLoginAt: string | null
  lastActiveAt: string | null
}

export interface WorkspaceRecord {
  id: string
  name: string
  createdAt: string
  memberIds: string[]
}

export type AuditAction =
  | 'onboarding_completed'
  | 'login'
  | 'login_failed'
  | 'account_locked_out'
  | 'logout'
  | 'lock'
  | 'auto_locked'
  | 'session_timeout'
  | 'pin_changed'
  | 'pin_reset_by_admin'
  | 'biometrics_enabled'
  | 'biometrics_disabled'
  | 'member_added'
  | 'member_disabled'
  | 'member_reactivated'
  | 'member_role_changed'
  | 'member_removed'
  | 'workspace_created'
  | 'workspace_renamed'
  | 'workspace_switched'
  | 'profile_updated'

export interface AuditEntry {
  id: string
  at: string
  workspaceId: string
  actorMemberId: string | null
  actorName: string
  action: AuditAction
  detail?: string
}

export interface SecurityPrefs {
  /** Minutes of inactivity before auto-lock; 0 means "never." */
  autoLockMinutes: number
  /** Absolute session cap in minutes since last unlock, regardless of activity. */
  sessionTimeoutMinutes: number
  maxPinAttempts: number
  lockoutMinutes: number
  desktopNotifications: boolean
}

export const DEFAULT_SECURITY_PREFS: SecurityPrefs = {
  autoLockMinutes: 5,
  sessionTimeoutMinutes: 720,
  maxPinAttempts: 5,
  lockoutMinutes: 1,
  desktopNotifications: false,
}

export interface AccountSnapshot {
  version: 2
  hasOnboarded: boolean
  workspaces: WorkspaceRecord[]
  members: MemberRecord[]
  currentWorkspaceId: string | null
  currentMemberId: string | null
  auditLog: AuditEntry[]
  security: SecurityPrefs
  failedPinAttempts: number
  lockedUntil: string | null
  /** Stable random id for this browser install, shown on the Active Sessions/Connected Devices page. */
  deviceId: string
  unlockedAt: string | null
}
