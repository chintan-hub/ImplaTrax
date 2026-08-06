import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase/client'
import { accountRoleToDb, accountRoleFromDb } from '@/lib/supabase/mappers'
import { hashPin, generateSalt } from './crypto'
import { isPlatformAuthenticatorAvailable, registerPasskey, verifyPasskey } from './webauthn'
import { getDeviceId, getDevicePin, setDevicePin, getLastWorkspaceId, setLastWorkspaceId, clearDeviceStore } from './devicePairing'
import { seedDemoWorkspace } from '@/lib/supabase/demoSeed'
import { describeAuthError, isEmailAlreadyRegisteredError, isObfuscatedExistingUserSignUp } from './authErrors'
import { WORKSPACE_MANAGER_ROLES, DEFAULT_SECURITY_PREFS } from './accountTypes'
import { setCurrentActor } from '@/store/currentActor'
import type { AccountRole, AuditEntry, SecurityPrefs } from './accountTypes'

export type AuthStatus = 'onboarding' | 'locked' | 'unlocked'

export interface OnboardingInput {
  workspaceName: string
  name: string
  contact: string
  password?: string
  pin: string
  enableBiometrics: boolean
  companyName?: string
  country?: string
  currency?: string
  logoDataUrl?: string
}

export type LogInResult = { ok: true; needsNewPin: boolean } | { ok: false; error: string } | { ok: 'pending-confirmation' }

/** `emailExists` lets the UI offer "Sign in instead" specifically — every other failure is just a message to show and let the user retry. */
export type CompleteOnboardingResult =
  | { ok: true; workspaceName: string; name: string; contact: string }
  | { ok: false; error: string; emailExists?: boolean }

export interface AuthIdentity {
  name: string
  contact: string
}

export type ActionResult = { ok: true; id?: string } | { ok: false; error: string }

export interface MemberRecord {
  id: string
  name: string
  contact: string
  role: AccountRole
  status: 'active' | 'disabled' | 'invited'
  createdAt: string
  lastLoginAt: string | null
  lastActiveAt: string | null
}

export interface WorkspaceRecord {
  id: string
  name: string
  createdAt: string
}

interface AuthContextValue {
  status: AuthStatus
  identity: AuthIdentity | null
  currentMember: MemberRecord | null
  currentWorkspace: WorkspaceRecord | null
  workspaceMembers: MemberRecord[]
  activeWorkspaceMembers: MemberRecord[]
  workspaces: WorkspaceRecord[]
  auditLog: AuditEntry[]
  security: SecurityPrefs
  deviceId: string
  hasBiometrics: boolean
  platformAuthAvailable: boolean
  mustChangePin: boolean
  failedPinAttempts: number
  lockedUntil: string | null
  loading: boolean

  completeOnboarding: (input: OnboardingInput) => Promise<CompleteOnboardingResult>
  /**
   * Creates an isolated, throwaway workspace pre-seeded with realistic demo
   * data and signs straight into it — for "try it now" without the
   * onboarding wizard. The generated login credentials are never shown, so
   * this workspace can't be revisited once the session ends; the returned
   * `pin` is the one thing worth surfacing, since a page reload re-locks the
   * device same as any other workspace and this is the only PIN that can
   * unlock it again.
   */
  startDemoWorkspace: () => Promise<{ ok: true; pin: string } | { ok: false; error: string }>
  logInWithPassword: (email: string, password: string) => Promise<LogInResult>
  /** Sends a Supabase Auth password-recovery email; the link lands the user back on /reset-password with a temporary recovery session. */
  requestPasswordReset: (email: string) => Promise<ActionResult>
  /** Sets a new password on the caller's current session — valid both for a normal signed-in session and the temporary recovery session /reset-password establishes. */
  updatePassword: (newPassword: string) => Promise<ActionResult>
  verifyPin: (pin: string) => Promise<boolean>
  verifyBiometrics: () => Promise<boolean>
  completeForcedPinChange: (newPin: string) => Promise<void>
  unlock: () => void
  lock: () => void
  logout: () => Promise<void>
  resetDevice: () => Promise<void>

  changePin: (oldPin: string, newPin: string) => Promise<boolean>
  enableBiometrics: () => Promise<boolean>
  disableBiometrics: () => void
  updateProfile: (name: string, contact: string) => Promise<void>
  setAutoLockMinutes: (minutes: number) => Promise<void>
  setSessionTimeoutMinutes: (minutes: number) => Promise<void>
  setDesktopNotifications: (enabled: boolean) => Promise<void>

  addMember: (input: { name: string; contact: string; role: AccountRole }) => Promise<ActionResult>
  disableMember: (id: string) => Promise<ActionResult>
  reactivateMember: (id: string) => Promise<ActionResult>
  changeMemberRole: (id: string, role: AccountRole) => Promise<ActionResult>
  removeMember: (id: string) => Promise<ActionResult>
  resetMemberPin: (id: string) => ActionResult

  createWorkspace: (name: string) => Promise<ActionResult>
  switchWorkspace: (id: string) => Promise<void>
  renameWorkspace: (name: string) => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

function memberFromRow(row: {
  id: string
  name: string
  contact_email: string | null
  account_role: string
  status: string
  created_at: string
  last_login_at: string | null
  last_active_at: string | null
}): MemberRecord {
  return {
    id: row.id,
    name: row.name,
    contact: row.contact_email ?? '',
    role: accountRoleFromDb(row.account_role) as AccountRole,
    status: row.status as MemberRecord['status'],
    createdAt: row.created_at,
    lastLoginAt: row.last_login_at,
    lastActiveAt: row.last_active_at,
  }
}

function client() {
  if (!supabase) throw new Error('Supabase is not configured — set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY')
  return supabase
}

function isLastActiveOwner(members: MemberRecord[], memberId: string): boolean {
  const owners = members.filter((m) => m.role === 'owner' && m.status === 'active')
  return owners.length <= 1 && owners[0]?.id === memberId
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true)
  const [session, setSession] = useState<Session | null>(null)
  const [status, setStatus] = useState<AuthStatus>('onboarding')
  const [workspaces, setWorkspaces] = useState<WorkspaceRecord[]>([])
  const [currentWorkspace, setCurrentWorkspaceState] = useState<WorkspaceRecord | null>(null)
  const [workspaceMembers, setWorkspaceMembers] = useState<MemberRecord[]>([])
  const [currentMember, setCurrentMember] = useState<MemberRecord | null>(null)
  const [security, setSecurity] = useState<SecurityPrefs>(DEFAULT_SECURITY_PREFS)
  const [auditLog, setAuditLog] = useState<AuditEntry[]>([])
  const [platformAuthAvailable, setPlatformAuthAvailable] = useState(false)
  const [mustChangePin, setMustChangePin] = useState(false)
  const [failedPinAttempts, setFailedPinAttempts] = useState(0)
  const [lockedUntil, setLockedUntil] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    isPlatformAuthenticatorAvailable().then((available) => {
      if (!cancelled) setPlatformAuthAvailable(available)
    })
    return () => {
      cancelled = true
    }
  }, [])

  const activeWorkspaceMembers = useMemo(() => workspaceMembers.filter((m) => m.status === 'active'), [workspaceMembers])

  useEffect(() => {
    setCurrentActor(currentMember ? { id: currentMember.id, name: currentMember.name } : null)
  }, [currentMember])

  /** Loads every workspace this authenticated user belongs to, picks the current one (last-used hint, else the first), and hydrates members/settings/audit for it. Also decides 'locked' vs 'unlocked' from this device's own PIN pairing for that member. */
  const hydrateFromSession = useCallback(async (activeSession: Session) => {
    const memberships = await client()
      .from('workspace_members')
      .select('id, workspace_id, name, contact_email, account_role, status, created_at, last_login_at, last_active_at, workspaces(id, name, created_at)')
      .eq('auth_user_id', activeSession.user.id)
      .eq('status', 'active')

    if (memberships.error || !memberships.data || memberships.data.length === 0) {
      setStatus('onboarding')
      return
    }

    const allWorkspaces: WorkspaceRecord[] = memberships.data
      .map((m) => m.workspaces as unknown as { id: string; name: string; created_at: string } | null)
      .filter((w): w is { id: string; name: string; created_at: string } => Boolean(w))
      .map((w) => ({ id: w.id, name: w.name, createdAt: w.created_at }))
    setWorkspaces(allWorkspaces)

    const lastId = getLastWorkspaceId()
    const chosen = allWorkspaces.find((w) => w.id === lastId) ?? allWorkspaces[0]
    if (!chosen) {
      setStatus('onboarding')
      return
    }
    setCurrentWorkspaceState(chosen)
    setLastWorkspaceId(chosen.id)

    const myMembership = memberships.data.find((m) => m.workspace_id === chosen.id)
    const me = myMembership ? memberFromRow(myMembership) : null
    setCurrentMember(me)

    const [membersRes, settingsRes, securityRes] = await Promise.all([
      client().from('workspace_members').select('id, name, contact_email, account_role, status, created_at, last_login_at, last_active_at').eq('workspace_id', chosen.id),
      client().from('clinic_settings').select('*').eq('workspace_id', chosen.id).single(),
      client().from('security_prefs').select('*').eq('workspace_id', chosen.id).single(),
    ])
    if (membersRes.data) setWorkspaceMembers(membersRes.data.map(memberFromRow))
    if (securityRes.data) {
      setSecurity({
        autoLockMinutes: securityRes.data.auto_lock_minutes,
        sessionTimeoutMinutes: securityRes.data.session_timeout_minutes,
        maxPinAttempts: securityRes.data.max_pin_attempts,
        lockoutMinutes: securityRes.data.lockout_minutes,
        desktopNotifications: securityRes.data.desktop_notifications,
      })
    }
    void settingsRes

    const auditRes = await client().from('audit_log').select('*').eq('workspace_id', chosen.id).order('created_at', { ascending: false }).limit(300)
    if (auditRes.data) {
      setAuditLog(
        auditRes.data.map((e) => ({
          id: e.id,
          at: e.created_at,
          workspaceId: e.workspace_id,
          actorMemberId: e.actor_member_id,
          actorName: e.actor_name,
          action: e.action,
          detail: e.detail ?? undefined,
        })),
      )
    }

    if (!me) {
      setStatus('onboarding')
      return
    }
    const pairing = getDevicePin(me.id)
    if (!pairing || !pairing.pinHash) {
      setMustChangePin(true)
      setStatus('locked')
    } else {
      setMustChangePin(pairing.mustChangePin)
      setStatus('locked')
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    if (!supabase) {
      setLoading(false)
      setStatus('onboarding')
      return
    }
    supabase.auth.getSession().then(async ({ data }) => {
      if (cancelled) return
      setSession(data.session)
      if (data.session) {
        await hydrateFromSession(data.session)
      } else {
        setStatus('onboarding')
      }
      setLoading(false)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession)
    })
    return () => {
      cancelled = true
      sub.subscription.unsubscribe()
    }
    // hydrateFromSession is stable across renders (useCallback, no changing deps) — including it would just re-run this identical setup on every render
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const completeOnboarding = useCallback(
    async (input: OnboardingInput): Promise<CompleteOnboardingResult> => {
      try {
        const email = input.contact.trim()
        const { data: signUpData, error: signUpError } = await client().auth.signUp({ email, password: input.password ?? '' })
        if (signUpError) {
          if (isEmailAlreadyRegisteredError(signUpError)) {
            return { ok: false, error: 'An account with this email already exists. Please sign in instead.', emailExists: true }
          }
          return { ok: false, error: describeAuthError(signUpError) }
        }
        // Confirm-email-enabled projects never return a real error for a
        // duplicate signup (to avoid leaking which emails are registered) —
        // instead they return this obfuscated user/no-session shape.
        if (isObfuscatedExistingUserSignUp(signUpData)) {
          return { ok: false, error: 'An account with this email already exists. Please sign in instead.', emailExists: true }
        }
        if (!signUpData.session) {
          return { ok: false, error: 'Check your email to confirm your account, then log in. (Supabase project has email confirmation enabled — disable it under Authentication settings for instant onboarding.)' }
        }
        setSession(signUpData.session)

        const workspaceId = unwrapRpc<string>(await client().rpc('create_workspace', { p_workspace_name: input.workspaceName.trim(), p_member_name: input.name.trim(), p_contact_email: email }))
        unwrapRpc(
          await client().rpc('complete_onboarding', {
            p_workspace_id: workspaceId,
            p_clinic_name: input.companyName?.trim() || input.workspaceName.trim(),
            p_country: input.country ?? '',
            p_currency: input.currency ?? 'INR',
            p_logo_url: input.logoDataUrl || null,
          }),
        )

        const memberRow = unwrapRpc<{
          id: string; name: string; contact_email: string | null; account_role: string; status: string
          created_at: string; last_login_at: string | null; last_active_at: string | null
        }>(
          await client().from('workspace_members').select('id, name, contact_email, account_role, status, created_at, last_login_at, last_active_at').eq('workspace_id', workspaceId).eq('auth_user_id', signUpData.session.user.id).single(),
        )
        const me = memberFromRow(memberRow)

        const salt = generateSalt()
        const pinHash = await hashPin(input.pin, salt)
        const webauthnCredentialId = input.enableBiometrics ? await registerPasskey(input.name, input.contact) : null
        setDevicePin(me.id, { pinHash, pinSalt: salt, mustChangePin: false, webauthnCredentialId })
        setLastWorkspaceId(workspaceId)

        setCurrentWorkspaceState({ id: workspaceId, name: input.workspaceName.trim(), createdAt: new Date().toISOString() })
        setWorkspaces((prev) => [...prev, { id: workspaceId, name: input.workspaceName.trim(), createdAt: new Date().toISOString() }])
        setCurrentMember(me)
        setWorkspaceMembers([me])
        setMustChangePin(false)
        setStatus('unlocked')
        return { ok: true, workspaceName: input.workspaceName, name: input.name, contact: input.contact }
      } catch (err) {
        return { ok: false, error: describeAuthError(err) }
      }
    },
    [],
  )

  const startDemoWorkspace = useCallback(async (): Promise<{ ok: true; pin: string } | { ok: false; error: string }> => {
    try {
      const demoId = crypto.randomUUID().slice(0, 8)
      const email = `demo-${demoId}@implatrax-demo.local`
      const password = crypto.randomUUID()
      const { data: signUpData, error: signUpError } = await client().auth.signUp({ email, password })
      if (signUpError) throw new Error(signUpError.message)
      if (!signUpData.session) throw new Error('Could not start a demo session — please try again.')
      setSession(signUpData.session)

      const workspaceId = unwrapRpc<string>(await client().rpc('create_workspace', { p_workspace_name: 'Demo Workspace', p_member_name: 'Demo User', p_contact_email: email }))
      unwrapRpc(await client().rpc('complete_onboarding', { p_workspace_id: workspaceId, p_clinic_name: 'Demo Dental Clinic', p_country: 'United States', p_currency: 'INR' }))

      await seedDemoWorkspace(workspaceId)

      const memberRow = unwrapRpc<{
        id: string; name: string; contact_email: string | null; account_role: string; status: string
        created_at: string; last_login_at: string | null; last_active_at: string | null
      }>(
        await client().from('workspace_members').select('id, name, contact_email, account_role, status, created_at, last_login_at, last_active_at').eq('workspace_id', workspaceId).eq('auth_user_id', signUpData.session.user.id).single(),
      )
      const me = memberFromRow(memberRow)

      const salt = generateSalt()
      // Fixed, not random: every demo workspace uses the same well-known
      // PIN so it can be shared/documented without needing to look it up.
      const pin = '0000'
      const pinHash = await hashPin(pin, salt)
      setDevicePin(me.id, { pinHash, pinSalt: salt, mustChangePin: false, webauthnCredentialId: null })
      setLastWorkspaceId(workspaceId)

      setCurrentWorkspaceState({ id: workspaceId, name: 'Demo Workspace', createdAt: new Date().toISOString() })
      setWorkspaces((prev) => [...prev, { id: workspaceId, name: 'Demo Workspace', createdAt: new Date().toISOString() }])
      setCurrentMember(me)
      setWorkspaceMembers([me])
      setMustChangePin(false)
      setStatus('unlocked')
      return { ok: true, pin }
    } catch (err) {
      return { ok: false, error: describeAuthError(err) }
    }
  }, [])

  const verifyPin = useCallback(
    async (pin: string) => {
      if (lockedUntil && new Date(lockedUntil).getTime() > Date.now()) return false
      const member = currentMember
      if (!member) return false
      const pairing = getDevicePin(member.id)
      if (!pairing?.pinHash || !pairing.pinSalt) return false
      const candidate = await hashPin(pin, pairing.pinSalt)
      const ok = candidate === pairing.pinHash
      if (ok) {
        setFailedPinAttempts(0)
        setLockedUntil(null)
        void client().from('workspace_members').update({ last_login_at: new Date().toISOString(), last_active_at: new Date().toISOString() }).eq('id', member.id)
      } else {
        const attempts = failedPinAttempts + 1
        if (attempts >= security.maxPinAttempts) {
          setLockedUntil(new Date(Date.now() + security.lockoutMinutes * 60_000).toISOString())
          setFailedPinAttempts(0)
        } else {
          setFailedPinAttempts(attempts)
        }
      }
      return ok
    },
    [lockedUntil, currentMember, failedPinAttempts, security],
  )

  const verifyBiometrics = useCallback(async () => {
    if (!currentMember) return false
    const pairing = getDevicePin(currentMember.id)
    if (!pairing?.webauthnCredentialId) return false
    const ok = await verifyPasskey(pairing.webauthnCredentialId)
    if (ok) void client().from('workspace_members').update({ last_login_at: new Date().toISOString(), last_active_at: new Date().toISOString() }).eq('id', currentMember.id)
    return ok
  }, [currentMember])

  const completeForcedPinChange = useCallback(
    async (newPin: string) => {
      if (!currentMember) return
      const salt = generateSalt()
      const pinHash = await hashPin(newPin, salt)
      setDevicePin(currentMember.id, { pinHash, pinSalt: salt, mustChangePin: false, webauthnCredentialId: getDevicePin(currentMember.id)?.webauthnCredentialId ?? null })
      setMustChangePin(false)
      setStatus('unlocked')
    },
    [currentMember],
  )

  const unlock = useCallback(() => setStatus('unlocked'), [])
  const lock = useCallback(() => setStatus('locked'), [])

  const logout = useCallback(async () => {
    await client().auth.signOut()
    setSession(null)
    setStatus('onboarding')
    setCurrentMember(null)
    setWorkspaceMembers([])
    setCurrentWorkspaceState(null)
  }, [])

  const resetDevice = useCallback(async () => {
    clearDeviceStore()
    await client().auth.signOut()
    setSession(null)
    setStatus('onboarding')
    setCurrentMember(null)
    setWorkspaceMembers([])
    setCurrentWorkspaceState(null)
  }, [])

  const changePin = useCallback(
    async (oldPin: string, newPin: string) => {
      if (!currentMember) return false
      const pairing = getDevicePin(currentMember.id)
      if (!pairing?.pinHash || !pairing.pinSalt) return false
      const candidate = await hashPin(oldPin, pairing.pinSalt)
      if (candidate !== pairing.pinHash) return false
      const salt = generateSalt()
      const pinHash = await hashPin(newPin, salt)
      setDevicePin(currentMember.id, { ...pairing, pinHash, pinSalt: salt })
      return true
    },
    [currentMember],
  )

  const enableBiometrics = useCallback(async () => {
    if (!currentMember) return false
    const credId = await registerPasskey(currentMember.name, currentMember.contact)
    if (!credId) return false
    const pairing = getDevicePin(currentMember.id)
    setDevicePin(currentMember.id, { pinHash: pairing?.pinHash ?? null, pinSalt: pairing?.pinSalt ?? null, mustChangePin: pairing?.mustChangePin ?? false, webauthnCredentialId: credId })
    return true
  }, [currentMember])

  const disableBiometrics = useCallback(() => {
    if (!currentMember) return
    const pairing = getDevicePin(currentMember.id)
    if (pairing) setDevicePin(currentMember.id, { ...pairing, webauthnCredentialId: null })
  }, [currentMember])

  const updateProfile = useCallback(
    async (name: string, contact: string) => {
      if (!currentMember) return
      unwrapRpc(await client().from('workspace_members').update({ name, contact_email: contact }).eq('id', currentMember.id))
      setCurrentMember({ ...currentMember, name, contact })
      setWorkspaceMembers((prev) => prev.map((m) => (m.id === currentMember.id ? { ...m, name, contact } : m)))
    },
    [currentMember],
  )

  const setAutoLockMinutes = useCallback(
    async (minutes: number) => {
      if (!currentWorkspace) return
      unwrapRpc(await client().from('security_prefs').update({ auto_lock_minutes: minutes }).eq('workspace_id', currentWorkspace.id))
      setSecurity((prev) => ({ ...prev, autoLockMinutes: minutes }))
    },
    [currentWorkspace],
  )
  const setSessionTimeoutMinutes = useCallback(
    async (minutes: number) => {
      if (!currentWorkspace) return
      unwrapRpc(await client().from('security_prefs').update({ session_timeout_minutes: minutes }).eq('workspace_id', currentWorkspace.id))
      setSecurity((prev) => ({ ...prev, sessionTimeoutMinutes: minutes }))
    },
    [currentWorkspace],
  )
  const setDesktopNotifications = useCallback(
    async (enabled: boolean) => {
      if (!currentWorkspace) return
      unwrapRpc(await client().from('security_prefs').update({ desktop_notifications: enabled }).eq('workspace_id', currentWorkspace.id))
      setSecurity((prev) => ({ ...prev, desktopNotifications: enabled }))
    },
    [currentWorkspace],
  )

  const logInWithPassword = useCallback(async (email: string, password: string): Promise<LogInResult> => {
    const trimmed = email.trim().toLowerCase()
    if (!trimmed || !password) return { ok: false, error: 'Enter your email and password.' }
    try {
      const { data, error } = await client().auth.signInWithPassword({ email: trimmed, password })
      if (error) return { ok: false, error: describeAuthError(error) }
      if (!data.session) return { ok: 'pending-confirmation' }
      setSession(data.session)
      await hydrateFromSession(data.session)
      // hydrateFromSession already set currentMember/status; report whether this device needs a fresh PIN.
      const me = await client().from('workspace_members').select('id').eq('auth_user_id', data.session.user.id).eq('status', 'active').limit(1).maybeSingle()
      const needsNewPin = me.data ? !getDevicePin(me.data.id)?.pinHash : true
      return { ok: true, needsNewPin }
    } catch (err) {
      return { ok: false, error: describeAuthError(err) }
    }
  }, [hydrateFromSession])

  const requestPasswordReset = useCallback(async (email: string): Promise<ActionResult> => {
    const trimmed = email.trim().toLowerCase()
    if (!trimmed) return { ok: false, error: 'Enter your email address.' }
    try {
      const { error } = await client().auth.resetPasswordForEmail(trimmed, { redirectTo: `${window.location.origin}/reset-password` })
      if (error) return { ok: false, error: describeAuthError(error) }
      return { ok: true }
    } catch (err) {
      return { ok: false, error: describeAuthError(err) }
    }
  }, [])

  const updatePassword = useCallback(async (newPassword: string): Promise<ActionResult> => {
    if (newPassword.length < 8) return { ok: false, error: 'Password must be at least 8 characters.' }
    try {
      const { error } = await client().auth.updateUser({ password: newPassword })
      if (error) return { ok: false, error: describeAuthError(error) }
      return { ok: true }
    } catch (err) {
      return { ok: false, error: describeAuthError(err) }
    }
  }, [])

  const addMember = useCallback(
    async (input: { name: string; contact: string; role: AccountRole }): Promise<ActionResult> => {
      if (!currentMember || !WORKSPACE_MANAGER_ROLES.includes(currentMember.role)) return { ok: false, error: 'You do not have permission to add team members.' }
      if (!currentWorkspace) return { ok: false, error: 'No active workspace.' }
      const trimmedName = input.name.trim()
      if (!trimmedName) return { ok: false, error: 'Name is required.' }
      const trimmedEmail = input.contact.trim().toLowerCase()
      if (!trimmedEmail) return { ok: false, error: 'Email is required to invite a team member.' }
      const { data, error } = await client()
        .from('workspace_invitations')
        .insert({ workspace_id: currentWorkspace.id, email: trimmedEmail, account_role: accountRoleToDb(input.role), business_role: 'front_desk', invited_by: currentMember.id })
        .select('id')
        .single()
      if (error) return { ok: false, error: error.message }
      return { ok: true, id: data.id }
    },
    [currentMember, currentWorkspace],
  )

  const disableMember = useCallback(
    async (id: string): Promise<ActionResult> => {
      if (!currentMember || !WORKSPACE_MANAGER_ROLES.includes(currentMember.role)) return { ok: false, error: 'You do not have permission to manage team members.' }
      if (id === currentMember.id) return { ok: false, error: 'You cannot disable your own account.' }
      if (isLastActiveOwner(workspaceMembers, id)) return { ok: false, error: 'This is the only owner — disable another owner first, or transfer ownership.' }
      const { error } = await client().from('workspace_members').update({ status: 'disabled' }).eq('id', id)
      if (error) return { ok: false, error: error.message }
      setWorkspaceMembers((prev) => prev.map((m) => (m.id === id ? { ...m, status: 'disabled' } : m)))
      return { ok: true }
    },
    [currentMember, workspaceMembers],
  )

  const reactivateMember = useCallback(
    async (id: string): Promise<ActionResult> => {
      if (!currentMember || !WORKSPACE_MANAGER_ROLES.includes(currentMember.role)) return { ok: false, error: 'You do not have permission to manage team members.' }
      const { error } = await client().from('workspace_members').update({ status: 'active' }).eq('id', id)
      if (error) return { ok: false, error: error.message }
      setWorkspaceMembers((prev) => prev.map((m) => (m.id === id ? { ...m, status: 'active' } : m)))
      return { ok: true }
    },
    [currentMember],
  )

  const changeMemberRole = useCallback(
    async (id: string, role: AccountRole): Promise<ActionResult> => {
      if (!currentMember || !WORKSPACE_MANAGER_ROLES.includes(currentMember.role)) return { ok: false, error: 'You do not have permission to change roles.' }
      if (role !== 'owner' && isLastActiveOwner(workspaceMembers, id)) return { ok: false, error: 'This is the only owner — promote another owner first.' }
      const { error } = await client().from('workspace_members').update({ account_role: accountRoleToDb(role) }).eq('id', id)
      if (error) return { ok: false, error: error.message }
      setWorkspaceMembers((prev) => prev.map((m) => (m.id === id ? { ...m, role } : m)))
      return { ok: true }
    },
    [currentMember, workspaceMembers],
  )

  const removeMember = useCallback(
    async (id: string): Promise<ActionResult> => {
      if (!currentMember || !WORKSPACE_MANAGER_ROLES.includes(currentMember.role)) return { ok: false, error: 'You do not have permission to remove team members.' }
      if (id === currentMember.id) return { ok: false, error: 'You cannot remove your own account.' }
      if (isLastActiveOwner(workspaceMembers, id)) return { ok: false, error: 'This is the only owner and cannot be removed.' }
      const { error } = await client().from('workspace_members').delete().eq('id', id)
      if (error) return { ok: false, error: error.message }
      setWorkspaceMembers((prev) => prev.filter((m) => m.id !== id))
      return { ok: true }
    },
    [currentMember, workspaceMembers],
  )

  /**
   * PINs are now device-local secrets (devicePairing.ts) — an admin on
   * workspace A's dashboard has no way to reach into a teammate's browser's
   * localStorage the way the original single-device build could reset an
   * in-memory record directly. There is no remote equivalent yet; surfacing
   * this clearly beats silently no-op-ing.
   */
  const resetMemberPin = useCallback((_id: string): ActionResult => {
    return { ok: false, error: 'PINs are set per-device now — ask them to use "Forgot PIN" on their own device instead.' }
  }, [])

  const createWorkspace = useCallback(
    async (name: string): Promise<ActionResult> => {
      const trimmed = name.trim()
      if (!trimmed) return { ok: false, error: 'Workspace name is required.' }
      if (!session) return { ok: false, error: 'Not signed in.' }
      try {
        const workspaceId = unwrapRpc<string>(await client().rpc('create_workspace', { p_workspace_name: trimmed, p_member_name: currentMember?.name ?? 'Owner', p_contact_email: session.user.email ?? null }))
        setWorkspaces((prev) => [...prev, { id: workspaceId, name: trimmed, createdAt: new Date().toISOString() }])
        return { ok: true, id: workspaceId }
      } catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : 'Could not create workspace.' }
      }
    },
    [session, currentMember],
  )

  const switchWorkspace = useCallback(
    async (id: string) => {
      if (!session) return
      setLastWorkspaceId(id)
      await hydrateFromSession(session)
    },
    [session, hydrateFromSession],
  )

  const renameWorkspace = useCallback(
    async (name: string) => {
      const trimmed = name.trim()
      if (!trimmed || !currentWorkspace) return
      unwrapRpc(await client().from('workspaces').update({ name: trimmed }).eq('id', currentWorkspace.id))
      setCurrentWorkspaceState({ ...currentWorkspace, name: trimmed })
      setWorkspaces((prev) => prev.map((w) => (w.id === currentWorkspace.id ? { ...w, name: trimmed } : w)))
    },
    [currentWorkspace],
  )

  // Auto-lock on inactivity — only while genuinely unlocked, and only if enabled (0 = never).
  useEffect(() => {
    if (status !== 'unlocked' || security.autoLockMinutes <= 0) return
    let timer: ReturnType<typeof setTimeout>
    const reset = () => {
      clearTimeout(timer)
      timer = setTimeout(() => setStatus('locked'), security.autoLockMinutes * 60_000)
    }
    const events: (keyof WindowEventMap)[] = ['pointerdown', 'keydown', 'wheel', 'touchstart']
    events.forEach((e) => window.addEventListener(e, reset))
    reset()
    return () => {
      clearTimeout(timer)
      events.forEach((e) => window.removeEventListener(e, reset))
    }
  }, [status, security.autoLockMinutes])

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      identity: currentMember ? { name: currentMember.name, contact: currentMember.contact } : null,
      currentMember,
      currentWorkspace,
      workspaceMembers,
      activeWorkspaceMembers,
      workspaces,
      auditLog,
      security,
      deviceId: getDeviceId(),
      hasBiometrics: currentMember ? Boolean(getDevicePin(currentMember.id)?.webauthnCredentialId) : false,
      platformAuthAvailable,
      mustChangePin,
      failedPinAttempts,
      lockedUntil,
      loading,
      completeOnboarding,
      startDemoWorkspace,
      logInWithPassword,
      requestPasswordReset,
      updatePassword,
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
      status, currentMember, currentWorkspace, workspaceMembers, activeWorkspaceMembers, workspaces, auditLog, security,
      platformAuthAvailable, mustChangePin, failedPinAttempts, lockedUntil, loading, completeOnboarding, startDemoWorkspace, logInWithPassword,
      requestPasswordReset, updatePassword,
      verifyPin, verifyBiometrics, completeForcedPinChange, unlock, lock, logout, resetDevice, changePin, enableBiometrics,
      disableBiometrics, updateProfile, setAutoLockMinutes, setSessionTimeoutMinutes, setDesktopNotifications, addMember,
      disableMember, reactivateMember, changeMemberRole, removeMember, resetMemberPin, createWorkspace, switchWorkspace, renameWorkspace,
    ],
  )

  if (loading) return null
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

function unwrapRpc<T = void>({ data, error }: { data: T | null; error: { message: string } | null }): T {
  if (error) throw new Error(error.message)
  return data as T
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
