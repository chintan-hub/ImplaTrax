import type { ReactNode } from 'react'
import { useAuth } from './AuthContext'
import { OnboardingFlow } from './OnboardingFlow'
import { LoginScreen } from './LoginScreen'

/**
 * Sits above the routed app. The workspace name/name/contact captured during
 * onboarding lives only in this feature's own localStorage key — deliberately
 * not written into DataContext's clinicSettings/users, since wiring a real
 * "current user" through the rest of the app is its own larger, separately
 * tracked initiative (see PROJECT.md's permissions/AccessLevel work) and
 * outside this feature's scope.
 */
export function AuthGate({ children }: { children: ReactNode }) {
  const { status } = useAuth()

  if (status === 'onboarding') return <OnboardingFlow />
  if (status === 'locked') return <LoginScreen />
  return <>{children}</>
}
