import { describe, it, expect } from 'vitest'
import { hashPin, generateSalt } from './crypto'

describe('generateSalt', () => {
  it('produces a non-empty hex string that differs across calls', () => {
    const a = generateSalt()
    const b = generateSalt()
    expect(a).toMatch(/^[0-9a-f]+$/)
    expect(a.length).toBeGreaterThan(0)
    expect(a).not.toBe(b)
  })
})

describe('hashPin', () => {
  it('is deterministic for the same PIN and salt', async () => {
    const salt = generateSalt()
    const a = await hashPin('1234', salt)
    const b = await hashPin('1234', salt)
    expect(a).toBe(b)
  })

  it('produces different hashes for different PINs with the same salt', async () => {
    const salt = generateSalt()
    const a = await hashPin('1234', salt)
    const b = await hashPin('4321', salt)
    expect(a).not.toBe(b)
  })

  it('produces different hashes for the same PIN with different salts', async () => {
    const a = await hashPin('1234', 'salt-one')
    const b = await hashPin('1234', 'salt-two')
    expect(a).not.toBe(b)
  })

  it('returns a 64-character hex SHA-256 digest', async () => {
    const hash = await hashPin('1234', generateSalt())
    expect(hash).toMatch(/^[0-9a-f]{64}$/)
  })
})
