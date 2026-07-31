import { describe, it, expect, beforeEach } from 'vitest'
import { loadAuthSnapshot, saveAuthSnapshot, clearAuthSnapshot } from './authPersistence'
import type { AuthSnapshot } from './types'

describe('authPersistence', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('returns an empty/unonboarded snapshot when nothing is persisted', () => {
    const snapshot = loadAuthSnapshot()
    expect(snapshot.hasOnboarded).toBe(false)
    expect(snapshot.identity).toBeNull()
    expect(snapshot.pinHash).toBeNull()
  })

  it('round-trips a saved snapshot', () => {
    const snapshot: AuthSnapshot = {
      hasOnboarded: true,
      identity: { name: 'Dr. Sarah Chen', contact: 'sarah@example.com' },
      pinHash: 'abc123',
      pinSalt: 'saltvalue',
      webauthnCredentialId: 'cred-id',
    }
    saveAuthSnapshot(snapshot)
    expect(loadAuthSnapshot()).toEqual(snapshot)
  })

  it('falls back to the empty snapshot on corrupt JSON', () => {
    localStorage.setItem('implatrax:auth:v1', '{not valid json')
    const snapshot = loadAuthSnapshot()
    expect(snapshot.hasOnboarded).toBe(false)
  })

  it('clearAuthSnapshot removes the persisted snapshot', () => {
    saveAuthSnapshot({ hasOnboarded: true, identity: null, pinHash: 'x', pinSalt: 'y', webauthnCredentialId: null })
    clearAuthSnapshot()
    expect(loadAuthSnapshot().hasOnboarded).toBe(false)
  })
})
