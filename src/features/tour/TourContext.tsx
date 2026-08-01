import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import { TOUR_STEPS, type TourStep } from './tourSteps'

const STORAGE_KEY = 'implatrax:tour:v1'

interface TourPrefs {
  /** "Don't show again" — never re-offer the welcome prompt. */
  dismissedForever: boolean
  /** Set once the user has engaged with the tour at all (finished or skipped mid-way) — stops the welcome prompt from nagging on every visit even if they didn't explicitly say "don't show again." */
  completedOnce: boolean
}

function loadPrefs(): TourPrefs {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { dismissedForever: false, completedOnce: false }
    return { dismissedForever: false, completedOnce: false, ...(JSON.parse(raw) as Partial<TourPrefs>) }
  } catch {
    return { dismissedForever: false, completedOnce: false }
  }
}

function savePrefs(prefs: TourPrefs) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs))
  } catch {
    // best-effort — worst case the welcome prompt reappears next session
  }
}

interface TourContextValue {
  active: boolean
  promptOpen: boolean
  stepIndex: number
  totalSteps: number
  currentStep: TourStep | null
  isLastStep: boolean
  startTour: () => void
  closePrompt: () => void
  dontShowAgain: () => void
  next: () => void
  previous: () => void
  exitTour: () => void
}

const TourContext = createContext<TourContextValue | null>(null)

export function TourProvider({ children }: { children: ReactNode }) {
  const [active, setActive] = useState(false)
  const [stepIndex, setStepIndex] = useState(0)
  // Only ever offered once per fresh mount (i.e. once per app session after
  // unlocking) — AppLayout only exists while status === 'unlocked', so this
  // naturally fires right after onboarding or on first return to the app.
  // Gated to md+ viewports: every tour step targets the persistent sidebar,
  // which lives in a collapsed drawer below that breakpoint — offering the
  // tour there would spotlight nothing.
  const [promptOpen, setPromptOpen] = useState(() => {
    const prefs = loadPrefs()
    return typeof window !== 'undefined' && window.innerWidth >= 768 && !prefs.dismissedForever && !prefs.completedOnce
  })

  const persist = useCallback((patch: Partial<TourPrefs>) => {
    savePrefs({ ...loadPrefs(), ...patch })
  }, [])

  const startTour = useCallback(() => {
    setPromptOpen(false)
    setStepIndex(0)
    setActive(true)
  }, [])

  const closePrompt = useCallback(() => setPromptOpen(false), [])

  const dontShowAgain = useCallback(() => {
    setPromptOpen(false)
    persist({ dismissedForever: true })
  }, [persist])

  const next = useCallback(() => setStepIndex((i) => Math.min(i + 1, TOUR_STEPS.length - 1)), [])
  const previous = useCallback(() => setStepIndex((i) => Math.max(i - 1, 0)), [])

  const exitTour = useCallback(() => {
    setActive(false)
    persist({ completedOnce: true })
  }, [persist])

  const value = useMemo<TourContextValue>(
    () => ({
      active,
      promptOpen,
      stepIndex,
      totalSteps: TOUR_STEPS.length,
      currentStep: active ? (TOUR_STEPS[stepIndex] ?? null) : null,
      isLastStep: stepIndex === TOUR_STEPS.length - 1,
      startTour,
      closePrompt,
      dontShowAgain,
      next,
      previous,
      exitTour,
    }),
    [active, promptOpen, stepIndex, startTour, closePrompt, dontShowAgain, next, previous, exitTour],
  )

  return <TourContext.Provider value={value}>{children}</TourContext.Provider>
}

export function useTour() {
  const ctx = useContext(TourContext)
  if (!ctx) throw new Error('useTour must be used within TourProvider')
  return ctx
}
