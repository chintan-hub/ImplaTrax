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

/** Sourced from the DB enum (database.types.ts) — audit_log now records the full business-action list (products, POs, cases, sales, loans, wipes), not just the original workspace/security subset. */
import type { AuditAction } from '@/lib/supabase/database.types'
export type { AuditAction }

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
