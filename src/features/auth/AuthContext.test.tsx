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

  it('locks out PIN entry after the configured number of consecutive wrong attempts', async () => {
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
    act(() => result.current.lock())

    for (let i = 0; i < result.current.security.maxPinAttempts; i++) {
      await act(async () => {
        await result.current.verifyPin('0000')
      })
    }

    expect(result.current.lockedUntil).not.toBeNull()

    // Even the correct PIN is refused while locked out.
    let ok = true
    await act(async () => {
      ok = await result.current.verifyPin('1234')
    })
    expect(ok).toBe(false)
  })

  it('changePin requires the correct current PIN and updates it', async () => {
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

    let wrongChange = true
    await act(async () => {
      wrongChange = await result.current.changePin('0000', '5678')
    })
    expect(wrongChange).toBe(false)

    let rightChange = false
    await act(async () => {
      rightChange = await result.current.changePin('1234', '5678')
    })
    expect(rightChange).toBe(true)

    act(() => result.current.lock())
    let verifiedNew = false
    await act(async () => {
      verifiedNew = await result.current.verifyPin('5678')
    })
    expect(verifiedNew).toBe(true)
  })

  it('an owner can add a team member, and switching to them requires their own PIN', async () => {
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

    let addResult: Awaited<ReturnType<typeof result.current.addMember>> | undefined
    await act(async () => {
      addResult = await result.current.addMember({ name: 'Alex Rivera', contact: '', role: 'staff', pin: '4321' })
    })
    expect(addResult?.ok).toBe(true)
    expect(result.current.workspaceMembers).toHaveLength(2)
    expect(result.current.activeWorkspaceMembers).toHaveLength(2)

    const alexId = addResult!.ok ? addResult!.id! : ''
    act(() => result.current.switchUser(alexId))
    expect(result.current.status).toBe('locked')
    expect(result.current.currentMember?.name).toBe('Alex Rivera')

    let wrongPin = true
    await act(async () => {
      wrongPin = await result.current.verifyPin('1234') // the owner's PIN, not Alex's
    })
    expect(wrongPin).toBe(false)

    let rightPin = false
    await act(async () => {
      rightPin = await result.current.verifyPin('4321')
    })
    expect(rightPin).toBe(true)
  })

  it('a non-manager cannot add team members', async () => {
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
    let addResult: Awaited<ReturnType<typeof result.current.addMember>> | undefined
    await act(async () => {
      addResult = await result.current.addMember({ name: 'Alex Rivera', contact: '', role: 'staff', pin: '4321' })
    })
    const alexId = addResult!.ok ? addResult!.id! : ''
    act(() => result.current.switchUser(alexId))
    await act(async () => {
      await result.current.verifyPin('4321')
    })
    act(() => result.current.unlock())
    expect(result.current.currentMember?.role).toBe('staff')

    let secondAdd: Awaited<ReturnType<typeof result.current.addMember>> | undefined
    await act(async () => {
      secondAdd = await result.current.addMember({ name: 'Jordan Lee', contact: '', role: 'staff', pin: '1111' })
    })
    expect(secondAdd?.ok).toBe(false)
  })

  it('resetMemberPin forces the target to set a new PIN before their next unlock', async () => {
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
    let addResult: Awaited<ReturnType<typeof result.current.addMember>> | undefined
    await act(async () => {
      addResult = await result.current.addMember({ name: 'Alex Rivera', contact: '', role: 'staff', pin: '4321' })
    })
    const alexId = addResult!.ok ? addResult!.id! : ''

    act(() => {
      const reset = result.current.resetMemberPin(alexId)
      expect(reset.ok).toBe(true)
    })

    act(() => result.current.switchUser(alexId))
    expect(result.current.mustChangePin).toBe(true)

    await act(async () => {
      await result.current.completeForcedPinChange('9999')
    })
    expect(result.current.status).toBe('unlocked')
    expect(result.current.mustChangePin).toBe(false)
  })
})
