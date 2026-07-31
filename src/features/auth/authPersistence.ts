import type { AuthSnapshot } from './types'

const STORAGE_KEY = 'implatrax:auth:v1'

const EMPTY_SNAPSHOT: AuthSnapshot = {
  hasOnboarded: false,
  identity: null,
  pinHash: null,
  pinSalt: null,
  webauthnCredentialId: null,
}

export function loadAuthSnapshot(): AuthSnapshot {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return EMPTY_SNAPSHOT
    return { ...EMPTY_SNAPSHOT, ...(JSON.parse(raw) as Partial<AuthSnapshot>) }
  } catch {
    return EMPTY_SNAPSHOT
  }
}

export function saveAuthSnapshot(snapshot: AuthSnapshot) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot))
  } catch {
    // localStorage unavailable or full — persistence is best-effort, not fatal to the session.
  }
}

export function clearAuthSnapshot() {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    // best-effort, same as above
  }
}
