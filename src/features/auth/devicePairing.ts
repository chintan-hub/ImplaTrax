/**
 * What stays 100% local even after the Supabase migration: the device's own
 * stable id, and — per member — the PIN hash/salt and WebAuthn credential id
 * that make unlocking THIS browser fast. None of this is portable to
 * another device on purpose (migration 0002's own comment: "a PIN created
 * on one device is never valid on another") — workspace/member truth now
 * lives in Supabase; this file only ever stores the device-scoped secrets
 * layered on top of an already-valid Supabase session.
 */

export interface DevicePin {
  pinHash: string | null
  pinSalt: string | null
  mustChangePin: boolean
  webauthnCredentialId: string | null
}

interface DeviceStore {
  deviceId: string
  pins: Record<string, DevicePin>
  /** Last workspace the user was active in on this device — a UX hint for which membership to land on after login, not a source of truth. */
  lastWorkspaceId: string | null
}

const STORAGE_KEY = 'implatrax:device:v1'

function randomId(): string {
  return typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : `id-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function emptyStore(): DeviceStore {
  return { deviceId: randomId(), pins: {}, lastWorkspaceId: null }
}

let cached: DeviceStore | null = null

function load(): DeviceStore {
  if (cached) return cached
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      cached = { ...emptyStore(), ...(JSON.parse(raw) as Partial<DeviceStore>) }
      return cached
    }
  } catch {
    // corrupted local storage should never crash the app — fall through to a fresh store
  }
  cached = emptyStore()
  save(cached)
  return cached
}

function save(store: DeviceStore) {
  cached = store
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store))
  } catch {
    // best-effort — losing device pairing just means re-verifying with a password next time
  }
}

export function getDeviceId(): string {
  return load().deviceId
}

export function getDevicePin(memberId: string): DevicePin | null {
  return load().pins[memberId] ?? null
}

export function setDevicePin(memberId: string, pin: DevicePin) {
  const store = load()
  save({ ...store, pins: { ...store.pins, [memberId]: pin } })
}

export function clearDevicePin(memberId: string) {
  const store = load()
  const rest = { ...store.pins }
  delete rest[memberId]
  save({ ...store, pins: rest })
}

export function getLastWorkspaceId(): string | null {
  return load().lastWorkspaceId
}

export function setLastWorkspaceId(workspaceId: string | null) {
  save({ ...load(), lastWorkspaceId: workspaceId })
}

/** Wipes every PIN/biometric pairing this device knows — used by "reset this device," not by anything that should also touch server data. */
export function clearDeviceStore() {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    // best-effort, same as above
  }
  cached = null
}
