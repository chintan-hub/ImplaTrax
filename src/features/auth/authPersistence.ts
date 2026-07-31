import type { AccountSnapshot, MemberRecord, WorkspaceRecord } from './accountTypes'
import { DEFAULT_SECURITY_PREFS } from './accountTypes'

const STORAGE_KEY = 'implatrax:account:v2'
/** The very first (single-user, single-workspace) shape this feature shipped with — read once for migration, never written again. */
const LEGACY_STORAGE_KEY = 'implatrax:auth:v1'

interface LegacyAuthSnapshot {
  hasOnboarded: boolean
  identity: { name: string; contact: string } | null
  pinHash: string | null
  pinSalt: string | null
  webauthnCredentialId: string | null
}

function randomId(): string {
  return typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : `id-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function emptySnapshot(): AccountSnapshot {
  return {
    version: 2,
    hasOnboarded: false,
    workspaces: [],
    members: [],
    currentWorkspaceId: null,
    currentMemberId: null,
    auditLog: [],
    security: { ...DEFAULT_SECURITY_PREFS },
    failedPinAttempts: 0,
    lockedUntil: null,
    deviceId: randomId(),
    unlockedAt: null,
  }
}

/** One-time upgrade from the original single-user snapshot into a workspace + owner member — runs at most once, since it deletes the legacy key after migrating. */
function migrateLegacySnapshot(): AccountSnapshot | null {
  let raw: string | null
  try {
    raw = localStorage.getItem(LEGACY_STORAGE_KEY)
  } catch {
    return null
  }
  if (!raw) return null

  let legacy: LegacyAuthSnapshot
  try {
    legacy = JSON.parse(raw) as LegacyAuthSnapshot
  } catch {
    return null
  }
  if (!legacy.hasOnboarded) {
    try {
      localStorage.removeItem(LEGACY_STORAGE_KEY)
    } catch {
      // best-effort
    }
    return null
  }

  const now = new Date().toISOString()
  const workspaceId = randomId()
  const memberId = randomId()
  const owner: MemberRecord = {
    id: memberId,
    name: legacy.identity?.name ?? 'Owner',
    contact: legacy.identity?.contact ?? '',
    role: 'owner',
    status: 'active',
    pinHash: legacy.pinHash,
    pinSalt: legacy.pinSalt,
    webauthnCredentialId: legacy.webauthnCredentialId,
    mustChangePin: false,
    createdAt: now,
    lastLoginAt: null,
    lastActiveAt: null,
  }
  const workspace: WorkspaceRecord = { id: workspaceId, name: 'My Workspace', createdAt: now, memberIds: [memberId] }

  const snapshot: AccountSnapshot = {
    ...emptySnapshot(),
    hasOnboarded: true,
    workspaces: [workspace],
    members: [owner],
    currentWorkspaceId: workspaceId,
    currentMemberId: memberId,
  }

  try {
    localStorage.removeItem(LEGACY_STORAGE_KEY)
  } catch {
    // best-effort
  }
  return snapshot
}

export function loadAccountSnapshot(): AccountSnapshot {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<AccountSnapshot>
      return { ...emptySnapshot(), ...parsed, security: { ...DEFAULT_SECURITY_PREFS, ...parsed.security } }
    }
  } catch {
    // fall through to migration/empty below — corrupted local storage should never crash the app
  }

  const migrated = migrateLegacySnapshot()
  if (migrated) {
    saveAccountSnapshot(migrated)
    return migrated
  }
  return emptySnapshot()
}

export function saveAccountSnapshot(snapshot: AccountSnapshot) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot))
  } catch {
    // localStorage unavailable or full — persistence is best-effort, not fatal to the session.
  }
}

export function clearAccountSnapshot() {
  try {
    localStorage.removeItem(STORAGE_KEY)
    localStorage.removeItem(LEGACY_STORAGE_KEY)
  } catch {
    // best-effort, same as above
  }
}

export { randomId }
