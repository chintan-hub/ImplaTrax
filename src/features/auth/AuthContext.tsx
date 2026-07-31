import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { hashPin, generateSalt } from './crypto'
import { isPlatformAuthenticatorAvailable, registerPasskey, verifyPasskey } from './webauthn'
import { loadAccountSnapshot, saveAccountSnapshot, clearAccountSnapshot, randomId } from './authPersistence'
import { WORKSPACE_MANAGER_ROLES } from './accountTypes'
import type { AccountRole, AccountSnapshot, AuditAction, AuditEntry, MemberRecord, WorkspaceRecord } from './accountTypes'

export type AuthStatus = 'onboarding' | 'locked' | 'unlocked'

export interface OnboardingInput {
  workspaceName: string
  name: string
  contact: string
  pin: string
  enableBiometrics: boolean
}

export interface AuthIdentity {
  name: string
  contact: string
}

export type ActionResult = { ok: true; id?: string } | { ok: false; error: string }

interface AuthContextValue {
  status: AuthStatus
  identity: AuthIdentity | null
  currentMember: MemberRecord | null
  currentWorkspace: WorkspaceRecord | null
  /** All members (active + disabled) of the current workspace — for the Team settings table. */
  workspaceMembers: MemberRecord[]
  /** Active members only — used to decide whether the lock screen needs a "which of you is this" picker. */
  activeWorkspaceMembers: MemberRecord[]
  workspaces: WorkspaceRecord[]
  auditLog: AuditEntry[]
  security: import('./accountTypes').SecurityPrefs
  deviceId: string
  hasBiometrics: boolean
  platformAuthAvailable: boolean
  /** True once an admin has reset this member's PIN — the lock screen must show a Set-New-PIN step instead of a PIN pad. */
  mustChangePin: boolean
  failedPinAttempts: number
  lockedUntil: string | null

  completeOnboarding: (input: OnboardingInput) => Promise<{ workspaceName: string; name: string; contact: string }>
  verifyPin: (pin: string) => Promise<boolean>
  verifyBiometrics: () => Promise<boolean>
  completeForcedPinChange: (newPin: string) => Promise<void>
  unlock: () => void
  lock: () => void
  logout: () => void
  resetDevice: () => void

  changePin: (oldPin: string, newPin: string) => Promise<boolean>
  enableBiometrics: () => Promise<boolean>
  disableBiometrics: () => void
  updateProfile: (name: string, contact: string) => void
  setAutoLockMinutes: (minutes: number) => void
  setSessionTimeoutMinutes: (minutes: number) => void
  setDesktopNotifications: (enabled: boolean) => void

  switchUser: (memberId: string) => void
  addMember: (input: { name: string; contact: string; role: AccountRole; pin: string }) => Promise<ActionResult>
  disableMember: (id: string) => ActionResult
  reactivateMember: (id: string) => ActionResult
  changeMemberRole: (id: string, role: AccountRole) => ActionResult
  removeMember: (id: string) => ActionResult
  resetMemberPin: (id: string) => ActionResult

  createWorkspace: (name: string) => ActionResult
  switchWorkspace: (id: string) => void
  renameWorkspace: (name: string) => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

/** Pure — appends one capped, newest-first audit entry to a snapshot. Not a hook, so it's freely reusable inside any updater. */
function withAudit(snap: AccountSnapshot, action: AuditAction, detail?: string, actorOverride?: MemberRecord | null): AccountSnapshot {
  const actor = actorOverride !== undefined ? actorOverride : (snap.members.find((m) => m.id === snap.currentMemberId) ?? null)
  const entry: AuditEntry = {
    id: randomId(),
    at: new Date().toISOString(),
    workspaceId: snap.currentWorkspaceId ?? '',
    actorMemberId: actor?.id ?? null,
    actorName: actor?.name ?? 'System',
    action,
    detail,
  }
  return { ...snap, auditLog: [entry, ...snap.auditLog].slice(0, 300) }
}

function isLastActiveOwner(snap: AccountSnapshot, memberId: string): boolean {
  const workspace = snap.workspaces.find((w) => w.id === snap.currentWorkspaceId)
  if (!workspace) return false
  const owners = workspace.memberIds
    .map((id) => snap.members.find((m) => m.id === id))
    .filter((m): m is MemberRecord => Boolean(m) && m!.role === 'owner' && m!.status === 'active')
  return owners.length <= 1 && owners[0]?.id === memberId
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [snapshot, setSnapshotState] = useState<AccountSnapshot>(() => loadAccountSnapshot())
  const [status, setStatus] = useState<AuthStatus>(() => (loadAccountSnapshot().hasOnboarded ? 'locked' : 'onboarding'))
  const [platformAuthAvailable, setPlatformAuthAvailable] = useState(false)

  useEffect(() => {
    let cancelled = false
    isPlatformAuthenticatorAvailable().then((available) => {
      if (!cancelled) setPlatformAuthAvailable(available)
    })
    return () => {
      cancelled = true
    }
  }, [])

  const updateSnapshot = useCallback((updater: (prev: AccountSnapshot) => AccountSnapshot) => {
    setSnapshotState((prev) => {
      const next = updater(prev)
      saveAccountSnapshot(next)
      return next
    })
  }, [])

  const currentMember = useMemo(() => snapshot.members.find((m) => m.id === snapshot.currentMemberId) ?? null, [snapshot.members, snapshot.currentMemberId])
  const currentWorkspace = useMemo(() => snapshot.workspaces.find((w) => w.id === snapshot.currentWorkspaceId) ?? null, [snapshot.workspaces, snapshot.currentWorkspaceId])
  const workspaceMembers = useMemo(
    () => (currentWorkspace ? currentWorkspace.memberIds.map((id) => snapshot.members.find((m) => m.id === id)).filter((m): m is MemberRecord => Boolean(m)) : []),
    [currentWorkspace, snapshot.members],
  )
  const activeWorkspaceMembers = useMemo(() => workspaceMembers.filter((m) => m.status === 'active'), [workspaceMembers])
  const auditLog = useMemo(() => snapshot.auditLog.filter((e) => e.workspaceId === snapshot.currentWorkspaceId), [snapshot.auditLog, snapshot.currentWorkspaceId])

  const completeOnboarding = useCallback(
    async (input: OnboardingInput) => {
      const salt = generateSalt()
      const pinHash = await hashPin(input.pin, salt)
      const webauthnCredentialId = input.enableBiometrics ? await registerPasskey(input.name, input.contact) : null
      const now = new Date().toISOString()
      const workspaceId = randomId()
      const memberId = randomId()
      const owner: MemberRecord = {
        id: memberId,
        name: input.name,
        contact: input.contact,
        role: 'owner',
        status: 'active',
        pinHash,
        pinSalt: salt,
        webauthnCredentialId,
        mustChangePin: false,
        createdAt: now,
        lastLoginAt: now,
        lastActiveAt: now,
      }
      const workspace: WorkspaceRecord = { id: workspaceId, name: input.workspaceName, createdAt: now, memberIds: [memberId] }

      updateSnapshot((prev) =>
        withAudit(
          { ...prev, hasOnboarded: true, workspaces: [...prev.workspaces, workspace], members: [...prev.members, owner], currentWorkspaceId: workspaceId, currentMemberId: memberId, unlockedAt: now },
          'onboarding_completed',
          undefined,
          owner,
        ),
      )
      setStatus('unlocked')
      return { workspaceName: input.workspaceName, name: input.name, contact: input.contact }
    },
    [updateSnapshot],
  )

  const verifyPin = useCallback(
    async (pin: string) => {
      if (snapshot.lockedUntil && new Date(snapshot.lockedUntil).getTime() > Date.now()) return false
      const member = currentMember
      if (!member || !member.pinHash || !member.pinSalt) return false
      const candidate = await hashPin(pin, member.pinSalt)
      const ok = candidate === member.pinHash
      const now = new Date().toISOString()
      updateSnapshot((prev) => {
        if (ok) {
          const members = prev.members.map((m) => (m.id === member.id ? { ...m, lastLoginAt: now, lastActiveAt: now } : m))
          return withAudit({ ...prev, members, failedPinAttempts: 0, lockedUntil: null }, 'login')
        }
        const attempts = prev.failedPinAttempts + 1
        if (attempts >= prev.security.maxPinAttempts) {
          const until = new Date(Date.now() + prev.security.lockoutMinutes * 60_000).toISOString()
          return withAudit({ ...prev, failedPinAttempts: 0, lockedUntil: until }, 'account_locked_out')
        }
        return withAudit({ ...prev, failedPinAttempts: attempts }, 'login_failed')
      })
      return ok
    },
    [snapshot.lockedUntil, currentMember, updateSnapshot],
  )

  const verifyBiometrics = useCallback(async () => {
    if (!currentMember?.webauthnCredentialId) return false
    const ok = await verifyPasskey(currentMember.webauthnCredentialId)
    if (ok) {
      const now = new Date().toISOString()
      updateSnapshot((prev) => withAudit({ ...prev, members: prev.members.map((m) => (m.id === currentMember.id ? { ...m, lastLoginAt: now, lastActiveAt: now } : m)) }, 'login', 'via biometrics'))
    }
    return ok
  }, [currentMember, updateSnapshot])

  const completeForcedPinChange = useCallback(
    async (newPin: string) => {
      if (!currentMember) return
      const salt = generateSalt()
      const pinHash = await hashPin(newPin, salt)
      const now = new Date().toISOString()
      updateSnapshot((prev) =>
        withAudit(
          { ...prev, members: prev.members.map((m) => (m.id === currentMember.id ? { ...m, pinHash, pinSalt: salt, mustChangePin: false, lastLoginAt: now, lastActiveAt: now } : m)), unlockedAt: now },
          'pin_changed',
          'via forced reset',
        ),
      )
      setStatus('unlocked')
    },
    [currentMember, updateSnapshot],
  )

  const unlock = useCallback(() => {
    updateSnapshot((prev) => ({ ...prev, unlockedAt: new Date().toISOString() }))
    setStatus('unlocked')
  }, [updateSnapshot])

  const lock = useCallback(() => {
    updateSnapshot((prev) => withAudit(prev, 'lock'))
    setStatus('locked')
  }, [updateSnapshot])

  const logout = useCallback(() => {
    updateSnapshot((prev) => {
      const workspace = prev.workspaces.find((w) => w.id === prev.currentWorkspaceId)
      const activeCount = workspace ? workspace.memberIds.filter((id) => prev.members.find((m) => m.id === id)?.status === 'active').length : 0
      const next = withAudit(prev, 'logout')
      return activeCount > 1 ? { ...next, currentMemberId: null } : next
    })
    setStatus('locked')
  }, [updateSnapshot])

  const resetDevice = useCallback(() => {
    clearAccountSnapshot()
    setSnapshotState(loadAccountSnapshot())
    setStatus('onboarding')
  }, [])

  const changePin = useCallback(
    async (oldPin: string, newPin: string) => {
      if (!currentMember?.pinHash || !currentMember.pinSalt) return false
      const candidate = await hashPin(oldPin, currentMember.pinSalt)
      if (candidate !== currentMember.pinHash) return false
      const salt = generateSalt()
      const pinHash = await hashPin(newPin, salt)
      updateSnapshot((prev) => withAudit({ ...prev, members: prev.members.map((m) => (m.id === currentMember.id ? { ...m, pinHash, pinSalt: salt } : m)) }, 'pin_changed'))
      return true
    },
    [currentMember, updateSnapshot],
  )

  const enableBiometrics = useCallback(async () => {
    if (!currentMember) return false
    const credId = await registerPasskey(currentMember.name, currentMember.contact)
    if (!credId) return false
    updateSnapshot((prev) => withAudit({ ...prev, members: prev.members.map((m) => (m.id === currentMember.id ? { ...m, webauthnCredentialId: credId } : m)) }, 'biometrics_enabled'))
    return true
  }, [currentMember, updateSnapshot])

  const disableBiometrics = useCallback(() => {
    updateSnapshot((prev) => withAudit({ ...prev, members: prev.members.map((m) => (m.id === prev.currentMemberId ? { ...m, webauthnCredentialId: null } : m)) }, 'biometrics_disabled'))
  }, [updateSnapshot])

  const updateProfile = useCallback(
    (name: string, contact: string) => {
      updateSnapshot((prev) => withAudit({ ...prev, members: prev.members.map((m) => (m.id === prev.currentMemberId ? { ...m, name, contact } : m)) }, 'profile_updated'))
    },
    [updateSnapshot],
  )

  const setAutoLockMinutes = useCallback((minutes: number) => updateSnapshot((prev) => ({ ...prev, security: { ...prev.security, autoLockMinutes: minutes } })), [updateSnapshot])
  const setSessionTimeoutMinutes = useCallback((minutes: number) => updateSnapshot((prev) => ({ ...prev, security: { ...prev.security, sessionTimeoutMinutes: minutes } })), [updateSnapshot])
  const setDesktopNotifications = useCallback((enabled: boolean) => updateSnapshot((prev) => ({ ...prev, security: { ...prev.security, desktopNotifications: enabled } })), [updateSnapshot])

  const switchUser = useCallback(
    (memberId: string) => {
      updateSnapshot((prev) => ({ ...prev, currentMemberId: memberId, failedPinAttempts: 0, lockedUntil: null }))
      setStatus('locked')
    },
    [updateSnapshot],
  )

  const addMember = useCallback(
    async (input: { name: string; contact: string; role: AccountRole; pin: string }): Promise<ActionResult> => {
      if (!currentMember || !WORKSPACE_MANAGER_ROLES.includes(currentMember.role)) return { ok: false, error: 'You do not have permission to add team members.' }
      if (!currentWorkspace) return { ok: false, error: 'No active workspace.' }
      const trimmedName = input.name.trim()
      if (!trimmedName) return { ok: false, error: 'Name is required.' }
      if (workspaceMembers.some((m) => m.name.trim().toLowerCase() === trimmedName.toLowerCase())) {
        return { ok: false, error: 'A member with this name already exists in this workspace.' }
      }
      if (!/^\d{4}$/.test(input.pin)) return { ok: false, error: 'PIN must be 4 digits.' }

      const salt = generateSalt()
      const pinHash = await hashPin(input.pin, salt)
      const now = new Date().toISOString()
      const id = randomId()
      const member: MemberRecord = {
        id,
        name: trimmedName,
        contact: input.contact.trim(),
        role: input.role,
        status: 'active',
        pinHash,
        pinSalt: salt,
        webauthnCredentialId: null,
        mustChangePin: false,
        createdAt: now,
        lastLoginAt: null,
        lastActiveAt: null,
      }
      updateSnapshot((prev) =>
        withAudit(
          { ...prev, members: [...prev.members, member], workspaces: prev.workspaces.map((w) => (w.id === prev.currentWorkspaceId ? { ...w, memberIds: [...w.memberIds, id] } : w)) },
          'member_added',
          trimmedName,
        ),
      )
      return { ok: true, id }
    },
    [currentMember, currentWorkspace, workspaceMembers, updateSnapshot],
  )

  const disableMember = useCallback(
    (id: string): ActionResult => {
      if (!currentMember || !WORKSPACE_MANAGER_ROLES.includes(currentMember.role)) return { ok: false, error: 'You do not have permission to manage team members.' }
      if (id === currentMember.id) return { ok: false, error: 'You cannot disable your own account.' }
      if (isLastActiveOwner(snapshot, id)) return { ok: false, error: 'This is the only owner — disable another owner first, or transfer ownership.' }
      const target = snapshot.members.find((m) => m.id === id)
      updateSnapshot((prev) => withAudit({ ...prev, members: prev.members.map((m) => (m.id === id ? { ...m, status: 'disabled' } : m)) }, 'member_disabled', target?.name))
      return { ok: true }
    },
    [currentMember, snapshot, updateSnapshot],
  )

  const reactivateMember = useCallback(
    (id: string): ActionResult => {
      if (!currentMember || !WORKSPACE_MANAGER_ROLES.includes(currentMember.role)) return { ok: false, error: 'You do not have permission to manage team members.' }
      const target = snapshot.members.find((m) => m.id === id)
      updateSnapshot((prev) => withAudit({ ...prev, members: prev.members.map((m) => (m.id === id ? { ...m, status: 'active' } : m)) }, 'member_reactivated', target?.name))
      return { ok: true }
    },
    [currentMember, snapshot.members, updateSnapshot],
  )

  const changeMemberRole = useCallback(
    (id: string, role: AccountRole): ActionResult => {
      if (!currentMember || !WORKSPACE_MANAGER_ROLES.includes(currentMember.role)) return { ok: false, error: 'You do not have permission to change roles.' }
      if (role !== 'owner' && isLastActiveOwner(snapshot, id)) return { ok: false, error: 'This is the only owner — promote another owner first.' }
      const target = snapshot.members.find((m) => m.id === id)
      updateSnapshot((prev) => withAudit({ ...prev, members: prev.members.map((m) => (m.id === id ? { ...m, role } : m)) }, 'member_role_changed', `${target?.name} → ${role}`))
      return { ok: true }
    },
    [currentMember, snapshot, updateSnapshot],
  )

  const removeMember = useCallback(
    (id: string): ActionResult => {
      if (!currentMember || !WORKSPACE_MANAGER_ROLES.includes(currentMember.role)) return { ok: false, error: 'You do not have permission to remove team members.' }
      if (id === currentMember.id) return { ok: false, error: 'You cannot remove your own account.' }
      if (isLastActiveOwner(snapshot, id)) return { ok: false, error: 'This is the only owner and cannot be removed.' }
      const target = snapshot.members.find((m) => m.id === id)
      updateSnapshot((prev) =>
        withAudit(
          {
            ...prev,
            members: prev.members.filter((m) => m.id !== id),
            workspaces: prev.workspaces.map((w) => (w.id === prev.currentWorkspaceId ? { ...w, memberIds: w.memberIds.filter((mid) => mid !== id) } : w)),
          },
          'member_removed',
          target?.name,
        ),
      )
      return { ok: true }
    },
    [currentMember, snapshot, updateSnapshot],
  )

  const resetMemberPin = useCallback(
    (id: string): ActionResult => {
      if (!currentMember || !WORKSPACE_MANAGER_ROLES.includes(currentMember.role)) return { ok: false, error: 'You do not have permission to reset PINs.' }
      if (id === currentMember.id) return { ok: false, error: 'Use "Change PIN" in Security settings for your own PIN.' }
      const target = snapshot.members.find((m) => m.id === id)
      updateSnapshot((prev) =>
        withAudit({ ...prev, members: prev.members.map((m) => (m.id === id ? { ...m, pinHash: null, pinSalt: null, mustChangePin: true } : m)) }, 'pin_reset_by_admin', target?.name),
      )
      return { ok: true }
    },
    [currentMember, snapshot.members, updateSnapshot],
  )

  const createWorkspace = useCallback(
    (name: string): ActionResult => {
      const trimmed = name.trim()
      if (!trimmed) return { ok: false, error: 'Workspace name is required.' }
      if (snapshot.workspaces.some((w) => w.name.trim().toLowerCase() === trimmed.toLowerCase())) {
        return { ok: false, error: 'A workspace with this name already exists on this device.' }
      }
      const now = new Date().toISOString()
      const workspaceId = randomId()
      const memberId = randomId()
      const owner: MemberRecord = {
        id: memberId,
        name: currentMember?.name ?? 'Owner',
        contact: currentMember?.contact ?? '',
        role: 'owner',
        status: 'active',
        pinHash: null,
        pinSalt: null,
        webauthnCredentialId: null,
        mustChangePin: true,
        createdAt: now,
        lastLoginAt: null,
        lastActiveAt: null,
      }
      const workspace: WorkspaceRecord = { id: workspaceId, name: trimmed, createdAt: now, memberIds: [memberId] }
      updateSnapshot((prev) =>
        withAudit(
          { ...prev, workspaces: [...prev.workspaces, workspace], members: [...prev.members, owner], currentWorkspaceId: workspaceId, currentMemberId: memberId, failedPinAttempts: 0, lockedUntil: null },
          'workspace_created',
          trimmed,
        ),
      )
      setStatus('locked')
      return { ok: true, id: workspaceId }
    },
    [snapshot.workspaces, currentMember, updateSnapshot],
  )

  const switchWorkspace = useCallback(
    (id: string) => {
      const workspace = snapshot.workspaces.find((w) => w.id === id)
      if (!workspace) return
      const active = workspace.memberIds.map((mid) => snapshot.members.find((m) => m.id === mid)).filter((m): m is MemberRecord => Boolean(m) && m!.status === 'active')
      updateSnapshot((prev) =>
        withAudit({ ...prev, currentWorkspaceId: id, currentMemberId: active.length === 1 ? active[0]!.id : null, failedPinAttempts: 0, lockedUntil: null }, 'workspace_switched', workspace.name),
      )
      setStatus('locked')
    },
    [snapshot.workspaces, snapshot.members, updateSnapshot],
  )

  const renameWorkspace = useCallback(
    (name: string) => {
      const trimmed = name.trim()
      if (!trimmed) return
      updateSnapshot((prev) => withAudit({ ...prev, workspaces: prev.workspaces.map((w) => (w.id === prev.currentWorkspaceId ? { ...w, name: trimmed } : w)) }, 'workspace_renamed', trimmed))
    },
    [updateSnapshot],
  )

  // Auto-lock on inactivity — only while genuinely unlocked, and only if enabled (0 = never).
  useEffect(() => {
    if (status !== 'unlocked' || snapshot.security.autoLockMinutes <= 0) return
    let timer: ReturnType<typeof setTimeout>
    const reset = () => {
      clearTimeout(timer)
      timer = setTimeout(() => {
        updateSnapshot((prev) => withAudit(prev, 'auto_locked'))
        setStatus('locked')
      }, snapshot.security.autoLockMinutes * 60_000)
    }
    const events: (keyof WindowEventMap)[] = ['pointerdown', 'keydown', 'wheel', 'touchstart']
    events.forEach((e) => window.addEventListener(e, reset))
    reset()
    return () => {
      clearTimeout(timer)
      events.forEach((e) => window.removeEventListener(e, reset))
    }
  }, [status, snapshot.security.autoLockMinutes, updateSnapshot])

  // Absolute session cap since last unlock, independent of activity.
  useEffect(() => {
    if (status !== 'unlocked' || !snapshot.unlockedAt || snapshot.security.sessionTimeoutMinutes <= 0) return
    const deadline = new Date(snapshot.unlockedAt).getTime() + snapshot.security.sessionTimeoutMinutes * 60_000
    const remaining = deadline - Date.now()
    const expire = () => {
      updateSnapshot((prev) => withAudit(prev, 'session_timeout'))
      setStatus('locked')
    }
    if (remaining <= 0) {
      expire()
      return
    }
    const timer = setTimeout(expire, remaining)
    return () => clearTimeout(timer)
  }, [status, snapshot.unlockedAt, snapshot.security.sessionTimeoutMinutes, updateSnapshot])

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      identity: currentMember ? { name: currentMember.name, contact: currentMember.contact } : null,
      currentMember,
      currentWorkspace,
      workspaceMembers,
      activeWorkspaceMembers,
      workspaces: snapshot.workspaces,
      auditLog,
      security: snapshot.security,
      deviceId: snapshot.deviceId,
      hasBiometrics: currentMember?.webauthnCredentialId != null,
      platformAuthAvailable,
      mustChangePin: currentMember?.mustChangePin ?? false,
      failedPinAttempts: snapshot.failedPinAttempts,
      lockedUntil: snapshot.lockedUntil,
      completeOnboarding,
      verifyPin,
      verifyBiometrics,
      completeForcedPinChange,
      unlock,
      lock,
      logout,
      resetDevice,
      changePin,
      enableBiometrics,
      disableBiometrics,
      updateProfile,
      setAutoLockMinutes,
      setSessionTimeoutMinutes,
      setDesktopNotifications,
      switchUser,
      addMember,
      disableMember,
      reactivateMember,
      changeMemberRole,
      removeMember,
      resetMemberPin,
      createWorkspace,
      switchWorkspace,
      renameWorkspace,
    }),
    [
      status,
      currentMember,
      currentWorkspace,
      workspaceMembers,
      activeWorkspaceMembers,
      snapshot.workspaces,
      auditLog,
      snapshot.security,
      snapshot.deviceId,
      platformAuthAvailable,
      snapshot.failedPinAttempts,
      snapshot.lockedUntil,
      completeOnboarding,
      verifyPin,
      verifyBiometrics,
      completeForcedPinChange,
      unlock,
      lock,
      logout,
      resetDevice,
      changePin,
      enableBiometrics,
      disableBiometrics,
      updateProfile,
      setAutoLockMinutes,
      setSessionTimeoutMinutes,
      setDesktopNotifications,
      switchUser,
      addMember,
      disableMember,
      reactivateMember,
      changeMemberRole,
      removeMember,
      resetMemberPin,
      createWorkspace,
      switchWorkspace,
      renameWorkspace,
    ],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
