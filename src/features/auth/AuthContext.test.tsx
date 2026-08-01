import { describe, it, expect, beforeEach } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { AuthProvider, useAuth } from './AuthContext'
import { loadAccountSnapshot, saveAccountSnapshot } from './authPersistence'

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

  it('logInWithPassword rejects an unknown email or a wrong password, without changing status', async () => {
    const { result } = setup()
    await act(async () => {
      await result.current.completeOnboarding({
        workspaceName: 'Meridian Dental Implants',
        name: 'Dr. Sarah Chen',
        contact: 'sarah@meridiandental.com',
        password: 'correct-horse-battery',
        pin: '1234',
        enableBiometrics: false,
      })
    })
    act(() => result.current.lock())

    let unknownEmail: Awaited<ReturnType<typeof result.current.logInWithPassword>> | undefined
    await act(async () => {
      unknownEmail = await result.current.logInWithPassword('nobody@example.com', 'whatever')
    })
    expect(unknownEmail?.ok).toBe(false)
    expect(result.current.status).toBe('locked')

    let wrongPassword: Awaited<ReturnType<typeof result.current.logInWithPassword>> | undefined
    await act(async () => {
      wrongPassword = await result.current.logInWithPassword('sarah@meridiandental.com', 'nope')
    })
    expect(wrongPassword?.ok).toBe(false)
    expect(result.current.status).toBe('locked')
  })

  it('logInWithPassword succeeds without requiring a new PIN when this device already has one for that member', async () => {
    const { result } = setup()
    await act(async () => {
      await result.current.completeOnboarding({
        workspaceName: 'Meridian Dental Implants',
        name: 'Dr. Sarah Chen',
        contact: 'sarah@meridiandental.com',
        password: 'correct-horse-battery',
        pin: '1234',
        enableBiometrics: false,
      })
    })
    act(() => result.current.lock())

    let logIn: Awaited<ReturnType<typeof result.current.logInWithPassword>> | undefined
    await act(async () => {
      logIn = await result.current.logInWithPassword('sarah@meridiandental.com', 'correct-horse-battery')
    })
    expect(logIn).toEqual({ ok: true, needsNewPin: false })
    expect(result.current.mustChangePin).toBe(false)
    expect(result.current.currentMember?.name).toBe('Dr. Sarah Chen')
  })

  it('logInWithPassword requires a fresh device PIN when the stored PIN belongs to a different device', async () => {
    const first = setup()
    await act(async () => {
      await first.result.current.completeOnboarding({
        workspaceName: 'Meridian Dental Implants',
        name: 'Dr. Sarah Chen',
        contact: 'sarah@meridiandental.com',
        password: 'correct-horse-battery',
        pin: '1234',
        enableBiometrics: false,
      })
    })
    act(() => first.result.current.lock())

    // Simulate this PIN having been set up on a different device (the one
    // scenario Supabase sync will make real: the same account, opened for
    // the first time in a browser that has never seen it before).
    const snapshot = loadAccountSnapshot()
    saveAccountSnapshot({ ...snapshot, members: snapshot.members.map((m) => ({ ...m, pinDeviceId: 'some-other-device' })) })

    const second = setup()
    let logIn: Awaited<ReturnType<typeof second.result.current.logInWithPassword>> | undefined
    await act(async () => {
      logIn = await second.result.current.logInWithPassword('sarah@meridiandental.com', 'correct-horse-battery')
    })
    expect(logIn).toEqual({ ok: true, needsNewPin: true })
    expect(second.result.current.mustChangePin).toBe(true)

    await act(async () => {
      await second.result.current.completeForcedPinChange('4242')
    })
    expect(second.result.current.status).toBe('unlocked')
    expect(second.result.current.mustChangePin).toBe(false)
  })
})
