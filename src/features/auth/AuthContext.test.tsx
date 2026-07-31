import { describe, it, expect, beforeEach } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { AuthProvider, useAuth } from './AuthContext'

function setup() {
  return renderHook(() => useAuth(), { wrapper: AuthProvider })
}

describe('AuthContext', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('starts in the onboarding status with no persisted snapshot', () => {
    const { result } = setup()
    expect(result.current.status).toBe('onboarding')
    expect(result.current.identity).toBeNull()
  })

  it('completeOnboarding stores identity and unlocks immediately', async () => {
    const { result } = setup()

    await act(async () => {
      await result.current.completeOnboarding({
        workspaceName: 'Meridian Dental Implants',
        name: 'Dr. Sarah Chen',
        contact: 'sarah@meridiandental.com',
        pin: '1234',
        enableBiometrics: false,
      })
    })

    expect(result.current.status).toBe('unlocked')
    expect(result.current.identity).toEqual({ name: 'Dr. Sarah Chen', contact: 'sarah@meridiandental.com' })
    expect(result.current.hasBiometrics).toBe(false)
  })

  it('does not crash when biometrics enrollment is requested but unavailable (jsdom has no WebAuthn)', async () => {
    const { result } = setup()

    await act(async () => {
      await result.current.completeOnboarding({
        workspaceName: 'Meridian Dental Implants',
        name: 'Dr. Sarah Chen',
        contact: 'sarah@meridiandental.com',
        pin: '1234',
        enableBiometrics: true,
      })
    })

    expect(result.current.status).toBe('unlocked')
    expect(result.current.hasBiometrics).toBe(false) // registerPasskey gracefully fails without a platform authenticator
  })

  it('verifyPin returns true only for the PIN set during onboarding, and is a pure check (does not change status)', async () => {
    const { result } = setup()

    await act(async () => {
      await result.current.completeOnboarding({
        workspaceName: 'Meridian Dental Implants',
        name: 'Dr. Sarah Chen',
        contact: 'sarah@meridiandental.com',
        pin: '5678',
        enableBiometrics: false,
      })
    })

    act(() => result.current.lock())
    expect(result.current.status).toBe('locked')

    let wrongResult = true
    await act(async () => {
      wrongResult = await result.current.verifyPin('0000')
    })
    expect(wrongResult).toBe(false)
    expect(result.current.status).toBe('locked') // pure check — caller decides when to unlock

    let rightResult = false
    await act(async () => {
      rightResult = await result.current.verifyPin('5678')
    })
    expect(rightResult).toBe(true)
    expect(result.current.status).toBe('locked') // still locked until unlock() is called

    act(() => result.current.unlock())
    expect(result.current.status).toBe('unlocked')
  })

  it('resetDevice clears identity/PIN and returns to onboarding', async () => {
    const { result } = setup()

    await act(async () => {
      await result.current.completeOnboarding({
        workspaceName: 'Meridian Dental Implants',
        name: 'Dr. Sarah Chen',
        contact: 'sarah@meridiandental.com',
        pin: '1234',
        enableBiometrics: false,
      })
    })

    act(() => result.current.resetDevice())

    expect(result.current.status).toBe('onboarding')
    expect(result.current.identity).toBeNull()
  })

  it('a returning session (persisted onboarded snapshot) starts locked, not in onboarding', async () => {
    const first = setup()
    await act(async () => {
      await first.result.current.completeOnboarding({
        workspaceName: 'Meridian Dental Implants',
        name: 'Dr. Sarah Chen',
        contact: 'sarah@meridiandental.com',
        pin: '1234',
        enableBiometrics: false,
      })
    })

    // Simulate a fresh app load by mounting a brand-new provider against the same localStorage.
    const second = setup()
    expect(second.result.current.status).toBe('locked')
    expect(second.result.current.identity).toEqual({ name: 'Dr. Sarah Chen', contact: 'sarah@meridiandental.com' })
  })
})
