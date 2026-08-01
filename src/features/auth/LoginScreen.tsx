import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { Fingerprint, ArrowLeftRight, KeyRound } from 'lucide-react'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Logo } from '@/components/brand/Logo'
import { initials, cn } from '@/lib/utils'
import { useAuth } from './AuthContext'
import { AuthShowcasePanel } from './AuthShowcasePanel'
import { PinPad } from './PinPad'
import { AuthScreenHeader } from './AuthScreenHeader'
import { LogInWithEmailForm } from './LogInWithEmailForm'
import { ROLE_LABEL } from './roles'
import { PREMIUM_EASE } from './authTheme'

const PIN_LENGTH = 4
/** Shake + clear duration for a wrong PIN, and the correct-PIN unlock transition — both kept well under the "feel instant" budget. */
const FEEDBACK_MS = 420

/**
 * The right-pane authentication card — a solid, elevated surface rather
 * than the glass/gradient treatment used elsewhere in the auth flow. Sized
 * to fit every state (account picker, PIN entry, email login) without
 * scrolling at typical desktop viewport heights.
 */
const CARD_CLASS =
  'relative w-full max-w-md rounded-3xl border border-slate-200/80 bg-white p-6 shadow-2xl shadow-slate-900/10 sm:p-8 ' +
  'dark:border-white/[0.08] dark:bg-slate-900 dark:shadow-black/40'

function useLockoutCountdown(lockedUntil: string | null) {
  const [secondsLeft, setSecondsLeft] = useState(0)
  useEffect(() => {
    if (!lockedUntil) {
      setSecondsLeft(0)
      return
    }
    const tick = () => setSecondsLeft(Math.max(0, Math.ceil((new Date(lockedUntil).getTime() - Date.now()) / 1000)))
    tick()
    const id = setInterval(tick, 250)
    return () => clearInterval(id)
  }, [lockedUntil])
  return secondsLeft
}

export function LoginScreen() {
  const {
    verifyPin,
    verifyBiometrics,
    unlock,
    resetDevice,
    logout,
    switchUser,
    completeForcedPinChange,
    hasBiometrics,
    platformAuthAvailable,
    currentMember,
    activeWorkspaceMembers,
    mustChangePin,
    lockedUntil,
  } = useAuth()
  const [pin, setPin] = useState('')
  const [error, setError] = useState(false)
  const [busy, setBusy] = useState(false)
  const [unlocking, setUnlocking] = useState(false)
  const [forgotOpen, setForgotOpen] = useState(false)
  const [showEmailLogin, setShowEmailLogin] = useState(false)

  const [newPinPhase, setNewPinPhase] = useState<'create' | 'confirm'>('create')
  const [createdNewPin, setCreatedNewPin] = useState('')
  const [newPinValue, setNewPinValue] = useState('')
  const [newPinError, setNewPinError] = useState(false)
  const [newPinBusy, setNewPinBusy] = useState(false)

  const canUseBiometrics = hasBiometrics && platformAuthAvailable
  const lockoutSecondsLeft = useLockoutCountdown(lockedUntil)
  const isLockedOut = lockoutSecondsLeft > 0
  const showPicker = !currentMember && activeWorkspaceMembers.length > 0 && !showEmailLogin
  const showSetNewPin = Boolean(currentMember) && mustChangePin
  const paneRef = useRef<HTMLDivElement>(null)

  // The picker / set-new-PIN / enter-PIN / email-login states can differ in
  // height — keep whichever one is showing anchored to the top of its pane
  // instead of leaving scroll wherever a previous state left it (the page
  // itself never scrolls now, but the pane can on very short viewports).
  useEffect(() => {
    paneRef.current?.scrollTo(0, 0)
  }, [showPicker, showSetNewPin, showEmailLogin])

  const handleEmailLoginSuccess = (needsNewPin: boolean) => {
    setShowEmailLogin(false)
    if (!needsNewPin) {
      // They just proved who they are with their password — no need to also
      // demand the PIN they said they'd forgotten.
      setUnlocking(true)
      setTimeout(() => unlock(), FEEDBACK_MS)
    }
    // If a new PIN is needed, mustChangePin is now true for currentMember —
    // the existing showSetNewPin branch below picks it up on its own.
  }

  useEffect(() => {
    if (pin.length !== PIN_LENGTH || busy || isLockedOut) return
    setBusy(true)
    let cancelled = false
    void (async () => {
      const ok = await verifyPin(pin)
      if (cancelled) return
      if (ok) {
        setUnlocking(true)
        setTimeout(() => unlock(), FEEDBACK_MS)
      } else {
        setError(true)
        navigator.vibrate?.(30)
        setTimeout(() => {
          if (cancelled) return
          setError(false)
          setPin('')
          setBusy(false)
        }, FEEDBACK_MS)
      }
    })()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pin])

  const handleBiometrics = async () => {
    const ok = await verifyBiometrics()
    if (ok) {
      setUnlocking(true)
      setTimeout(() => unlock(), FEEDBACK_MS)
    } else {
      toast.error('Biometric authentication failed', { description: 'Enter your PIN instead.' })
    }
  }

  const handleNewPinComplete = (value: string) => {
    setNewPinValue(value)
    if (value.length !== PIN_LENGTH || newPinBusy) return

    if (newPinPhase === 'create') {
      setCreatedNewPin(value)
      setNewPinValue('')
      setNewPinPhase('confirm')
      return
    }

    if (value === createdNewPin) {
      setNewPinBusy(true)
      void completeForcedPinChange(value).then(() => toast.success('PIN updated', { description: 'Your new PIN is now active.' }))
    } else {
      setNewPinError(true)
      navigator.vibrate?.(30)
      setTimeout(() => {
        setNewPinError(false)
        setNewPinValue('')
        setCreatedNewPin('')
        setNewPinPhase('create')
      }, FEEDBACK_MS)
    }
  }

  return (
    <div className="relative flex h-screen w-screen flex-col overflow-hidden bg-white dark:bg-slate-950 lg:flex-row print:hidden">
      {/* Left: cursor-reactive wireframe mesh — a compact banner on mobile/tablet, a full-height pane from lg: up. */}
      <AuthShowcasePanel unlocking={unlocking} className="flex h-24 w-full shrink-0 sm:h-32 lg:h-full lg:w-[44%] xl:w-[42%]" />

      {/* Right: authentication pane. */}
      <div ref={paneRef} className="relative flex h-full w-full flex-1 flex-col items-center justify-center overflow-y-auto px-5 py-6 sm:px-8">
        <div className="absolute left-6 top-6 sm:left-8 sm:top-8 lg:left-12 lg:top-8">
          <Logo className="h-7 w-auto dark:brightness-110 sm:h-8" />
        </div>

        <motion.div
          className={CARD_CLASS}
          initial={{ opacity: 0, y: 14, scale: 0.99 }}
          animate={unlocking ? { opacity: 0, y: 0, scale: 0.98 } : { opacity: 1, y: 0, scale: 1 }}
          transition={unlocking ? { duration: 0.35, ease: PREMIUM_EASE } : { duration: 0.5, ease: PREMIUM_EASE }}
        >
          {showPicker ? (
            <div className="flex flex-col items-center gap-5 sm:gap-7">
              <AuthScreenHeader title="Who's Signing In?" subtitle="Choose your account to continue." />
              <div className="flex w-full flex-col gap-2">
                {activeWorkspaceMembers.map((member) => (
                  <button
                    key={member.id}
                    type="button"
                    onClick={() => switchUser(member.id)}
                    className="flex items-center gap-3 rounded-xl border border-slate-200/80 bg-slate-50/60 px-4 py-3 text-left transition-colors hover:border-teal-400/50 hover:bg-teal-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400 dark:border-white/10 dark:bg-white/[0.03] dark:hover:bg-teal-400/[0.08]"
                  >
                    <Avatar className="h-9 w-9">
                      <AvatarFallback className="text-xs">{initials(member.name)}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground">{member.name}</p>
                    </div>
                    <Badge variant="secondary">{ROLE_LABEL[member.role]}</Badge>
                  </button>
                ))}
              </div>
            </div>
          ) : showSetNewPin ? (
            <div className="flex flex-col items-center gap-5 sm:gap-7">
              <AuthScreenHeader
                title={newPinPhase === 'create' ? 'Set a New PIN' : 'Confirm Your New PIN'}
                subtitle={newPinPhase === 'create' ? 'For your security, choose a new 4-digit PIN for this device.' : 'Re-enter your new PIN to confirm.'}
              />
              <PinPad value={newPinValue} onChange={handleNewPinComplete} length={PIN_LENGTH} error={newPinError} disabled={newPinBusy} />
            </div>
          ) : showEmailLogin ? (
            <div className="flex flex-col items-center gap-5 sm:gap-7">
              <AuthScreenHeader title="Log In" subtitle="Use your email and password instead of your PIN." />
              <LogInWithEmailForm onSuccess={handleEmailLoginSuccess} />
              <button
                type="button"
                onClick={() => setShowEmailLogin(false)}
                className="rounded-md px-2 py-1 text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400"
              >
                Back to PIN
              </button>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-5 sm:gap-7">
              <AuthScreenHeader
                title="Enter Your PIN"
                subtitle={isLockedOut ? `Too many attempts. Try again in ${lockoutSecondsLeft}s.` : `Use your 4-digit PIN to continue${currentMember && activeWorkspaceMembers.length > 1 ? ` as ${currentMember.name}` : ''}.`}
              />

              <PinPad value={pin} onChange={setPin} length={PIN_LENGTH} error={error} success={unlocking} disabled={isLockedOut || (busy && !error)} />

              {/* Escape hatch — never trap a user on this screen: another device, a
                  different account, or biometrics are always one tap away. */}
              <div className="flex w-full flex-col items-center gap-3 border-t border-slate-200/80 pt-4 dark:border-white/10 sm:gap-4 sm:pt-6">
                <div className="flex items-center gap-2">
                  {canUseBiometrics && !isLockedOut && (
                    <button
                      type="button"
                      onClick={handleBiometrics}
                      disabled={busy}
                      aria-label="Use Face ID, Touch ID, or Windows Hello"
                      title="Use Face ID, Touch ID, or Windows Hello"
                      className={cn(
                        'flex h-10 w-10 touch-manipulation items-center justify-center rounded-full border border-slate-200/80 bg-slate-50/60 text-teal-600 transition-all',
                        'hover:-translate-y-px hover:border-teal-400/60 hover:bg-teal-50 hover:text-teal-700',
                        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400',
                        'dark:border-white/10 dark:bg-white/[0.03] dark:text-teal-300 dark:hover:bg-teal-400/[0.1] dark:hover:text-teal-200',
                      )}
                    >
                      <Fingerprint className="h-4.5 w-4.5" aria-hidden="true" />
                    </button>
                  )}
                  {activeWorkspaceMembers.length > 1 && (
                    <button
                      type="button"
                      onClick={logout}
                      className="flex items-center gap-1.5 rounded-md px-2 py-1 text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400"
                    >
                      <ArrowLeftRight className="h-3.5 w-3.5" aria-hidden="true" />
                      Switch User
                    </button>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => setShowEmailLogin(true)}
                  className="flex items-center gap-1.5 rounded-md px-2 py-1 text-sm font-medium text-teal-700 transition-colors hover:text-teal-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400 dark:text-teal-300 dark:hover:text-teal-200"
                >
                  <KeyRound className="h-3.5 w-3.5" aria-hidden="true" />
                  Not your account? Log in with Email &amp; Password
                </button>

                <button
                  type="button"
                  onClick={() => setForgotOpen(true)}
                  className="rounded-md px-2 py-1 text-xs text-muted-foreground/70 transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400"
                >
                  Forgot PIN
                </button>
              </div>
            </div>
          )}
        </motion.div>
      </div>

      <ConfirmDialog
        open={forgotOpen}
        onOpenChange={setForgotOpen}
        title="Reset this device?"
        description="You'll need to set up your workspace and PIN again. Your existing inventory data is stored separately and will not be affected."
        confirmLabel="Reset device"
        tone="destructive"
        onConfirm={resetDevice}
      />
    </div>
  )
}
