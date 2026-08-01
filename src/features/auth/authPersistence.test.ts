import { describe, it, expect, beforeEach } from 'vitest'
import { loadAccountSnapshot, saveAccountSnapshot, clearAccountSnapshot } from './authPersistence'
import type { AccountSnapshot } from './accountTypes'

describe('authPersistence', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('returns an empty/unonboarded snapshot when nothing is persisted', () => {
    const snapshot = loadAccountSnapshot()
    expect(snapshot.hasOnboarded).toBe(false)
    expect(snapshot.workspaces).toEqual([])
    expect(snapshot.members).toEqual([])
    expect(snapshot.deviceId).toBeTruthy()
  })

  it('round-trips a saved snapshot', () => {
    const base = loadAccountSnapshot()
    const snapshot: AccountSnapshot = {
      ...base,
      hasOnboarded: true,
      workspaces: [{ id: 'w1', name: 'Meridian Dental', createdAt: '2026-01-01T00:00:00.000Z', memberIds: ['m1'] }],
      members: [
        {
          id: 'm1',
          name: 'Dr. Sarah Chen',
          contact: 'sarah@example.com',
          role: 'owner',
          status: 'active',
          pinHash: 'abc123',
          pinSalt: 'saltvalue',
          passwordHash: null,
          passwordSalt: null,
          pinDeviceId: base.deviceId,
          webauthnCredentialId: null,
          mustChangePin: false,
          createdAt: '2026-01-01T00:00:00.000Z',
          lastLoginAt: null,
          lastActiveAt: null,
        },
      ],
      currentWorkspaceId: 'w1',
      currentMemberId: 'm1',
    }
    saveAccountSnapshot(snapshot)
    expect(loadAccountSnapshot()).toEqual(snapshot)
  })

  it('falls back to the empty snapshot on corrupt JSON', () => {
    localStorage.setItem('implatrax:account:v2', '{not valid json')
    const snapshot = loadAccountSnapshot()
    expect(snapshot.hasOnboarded).toBe(false)
  })

  it('migrates a legacy v1 single-user snapshot into a workspace + owner member', () => {
    localStorage.setItem(
      'implatrax:auth:v1',
      JSON.stringify({
        hasOnboarded: true,
        identity: { name: 'Dr. Sarah Chen', contact: 'sarah@example.com' },
        pinHash: 'legacy-hash',
        pinSalt: 'legacy-salt',
        webauthnCredentialId: null,
      }),
    )

    const snapshot = loadAccountSnapshot()
    expect(snapshot.hasOnboarded).toBe(true)
    expect(snapshot.workspaces).toHaveLength(1)
    expect(snapshot.members).toHaveLength(1)
    expect(snapshot.members[0]).toMatchObject({ name: 'Dr. Sarah Chen', role: 'owner', pinHash: 'legacy-hash' })
    expect(localStorage.getItem('implatrax:auth:v1')).toBeNull()
  })

  it('clearAccountSnapshot removes the persisted snapshot', () => {
    const snapshot = { ...loadAccountSnapshot(), hasOnboarded: true }
    saveAccountSnapshot(snapshot)
    clearAccountSnapshot()
    expect(loadAccountSnapshot().hasOnboarded).toBe(false)
  })
})
