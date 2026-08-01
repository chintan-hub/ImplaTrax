import { useEffect, useRef, type ReactNode } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from './AuthContext'
import { OnboardingFlow } from './OnboardingFlow'
import { LoginScreen } from './LoginScreen'

const LAST_PATH_KEY = 'implatrax:lastPath'

/**
 * Sits above the routed app. Action attribution (who performed a movement,
 * sale, etc.) is bridged into DataContext via src/store/currentActor.ts —
 * see that file's own comment for why it isn't done via React context.
 *
 * Also remembers where the user was when the app locked (manually, via
 * auto-lock, or a session timeout) and returns them there — once — after
 * they unlock, instead of always dropping back to the dashboard.
 */
export function AuthGate({ children }: { children: ReactNode }) {
  const { status } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const prevStatus = useRef(status)

  useEffect(() => {
    if (status === 'locked' && prevStatus.current === 'unlocked') {
      try {
        sessionStorage.setItem(LAST_PATH_KEY, location.pathname + location.search)
      } catch {
        // best-effort — losing the return path just means unlocking lands on the dashboard instead
      }
    }
    if (status === 'unlocked' && prevStatus.current === 'locked') {
      try {
        const lastPath = sessionStorage.getItem(LAST_PATH_KEY)
        sessionStorage.removeItem(LAST_PATH_KEY)
        if (lastPath && lastPath !== '/') navigate(lastPath, { replace: true })
      } catch {
        // best-effort, same as above
      }
    }
    prevStatus.current = status
    // location intentionally excluded — this effect only cares about status transitions, not every navigation while unlocked
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status])

  if (status === 'onboarding') return <OnboardingFlow />
  if (status === 'locked') return <LoginScreen />
  return <>{children}</>
}
