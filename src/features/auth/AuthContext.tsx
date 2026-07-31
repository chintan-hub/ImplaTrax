import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { hashPin, generateSalt } from './crypto'
import { isPlatformAuthenticatorAvailable, registerPasskey, verifyPasskey } from './webauthn'
import { loadAuthSnapshot, saveAuthSnapshot, clearAuthSnapshot } from './authPersistence'
import type { AuthIdentity, AuthSnapshot } from './types'

export type AuthStatus = 'onboarding' | 'locked' | 'unlocked'

export interface OnboardingInput {
  workspaceName: string
  name: string
  contact: string
  pin: string
  enableBiometrics: boolean
}

interface AuthContextValue {
  status: AuthStatus
  identity: AuthIdentity | null
  hasBiometrics: boolean
  platformAuthAvailable: boolean
  /** Registers the workspace/PIN and moves straight to unlocked — onboarding never re-prompts for the PIN it just set. */
  completeOnboarding: (input: OnboardingInput) => Promise<{ workspaceName: string; name: string; contact: string }>
  /** Pure check — does not change auth status. Callers choreograph the unlock transition, then call unlock(). */
  verifyPin: (pin: string) => Promise<boolean>
  verifyBiometrics: () => Promise<boolean>
  unlock: () => void
  lock: () => void
  /** "Forgot PIN" — clears only this device's lock/identity, not any inventory data (a separate localStorage key). */
  resetDevice: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [snapshot, setSnapshot] = useState<AuthSnapshot>(() => loadAuthSnapshot())
  const [status, setStatus] = useState<AuthStatus>(() => (loadAuthSnapshot().hasOnboarded ? 'locked' : 'onboarding'))
  const [platformAuthAvailable, setPlatformAuthAvailable] = useState(false)

  useEffect(() => {
    let cancelled = false
    isPlatformAuthenticatorAvailable().then((available) => {
      if (!cancelled) setPlatformAuthAvailable(available)
    })
    return () => {
      cancelled = true
    }
  }, [])

  const completeOnboarding = useCallback(async (input: OnboardingInput) => {
    const salt = generateSalt()
    const pinHash = await hashPin(input.pin, salt)
    const webauthnCredentialId = input.enableBiometrics ? await registerPasskey(input.name, input.contact) : null

    const next: AuthSnapshot = {
      hasOnboarded: true,
      identity: { name: input.name, contact: input.contact },
      pinHash,
      pinSalt: salt,
      webauthnCredentialId,
    }
    saveAuthSnapshot(next)
    setSnapshot(next)
    setStatus('unlocked')
    return { workspaceName: input.workspaceName, name: input.name, contact: input.contact }
  }, [])

  const verifyPin = useCallback(
    async (pin: string) => {
      if (!snapshot.pinHash || !snapshot.pinSalt) return false
      const candidate = await hashPin(pin, snapshot.pinSalt)
      return candidate === snapshot.pinHash
    },
    [snapshot.pinHash, snapshot.pinSalt],
  )

  const verifyBiometrics = useCallback(async () => {
    if (!snapshot.webauthnCredentialId) return false
    return verifyPasskey(snapshot.webauthnCredentialId)
  }, [snapshot.webauthnCredentialId])

  const unlock = useCallback(() => setStatus('unlocked'), [])
  const lock = useCallback(() => setStatus('locked'), [])

  const resetDevice = useCallback(() => {
    clearAuthSnapshot()
    setSnapshot(loadAuthSnapshot())
    setStatus('onboarding')
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      identity: snapshot.identity,
      hasBiometrics: snapshot.webauthnCredentialId != null,
      platformAuthAvailable,
      completeOnboarding,
      verifyPin,
      verifyBiometrics,
      unlock,
      lock,
      resetDevice,
    }),
    [status, snapshot.identity, snapshot.webauthnCredentialId, platformAuthAvailable, completeOnboarding, verifyPin, verifyBiometrics, unlock, lock, resetDevice],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
