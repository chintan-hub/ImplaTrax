import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Fingerprint, ArrowLeftRight } from 'lucide-react'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { initials } from '@/lib/utils'
import { useAuth } from './AuthContext'
import { AuthShowcasePanel } from './AuthShowcasePanel'
import { AuthBrandBlock } from './AuthBrandBlock'
import { PinPad } from './PinPad'
import { AuthScreenHeader } from './AuthScreenHeader'
import { LogInWithEmailForm } from './LogInWithEmailForm'
import { ROLE_LABEL } from './roles'
import { AUTH_BACKDROP_CLASS, AUTH_CARD_CLASS, AUTH_CARD_MOTION, AUTH_CONTENT_WRAPPER_CLASS, AUTH_SHOWCASE_PANEL_CLASS, PREMIUM_EASE } from './authTheme'

const PIN_LENGTH = 4
/** Shake + clear duration for a wrong PIN, and the correct-PIN unlock transition — both kept well under the "feel instant" budget. */
const FEEDBACK_MS = 420

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

  // The picker / set-new-PIN / enter-PIN / email-login states can differ in
  // height — keep whichever one is showing anchored to the top of the
  // viewport instead of leaving scroll wherever a previous state left it.
  useEffect(() => {
    window.scrollTo(0, 0)
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
    <div className="relative flex min-h-dvh w-full flex-col md:flex-row print:hidden">
      <AuthShowcasePanel unlocking={unlocking} className={AUTH_SHOWCASE_PANEL_CLASS} />

      <div className={`${AUTH_CONTENT_WRAPPER_CLASS} ${AUTH_BACKDROP_CLASS}`}>
        <AuthBrandBlock pulse={unlocking} />

        <motion.div
          className={AUTH_CARD_CLASS}
          initial={AUTH_CARD_MOTION.initial}
          animate={unlocking ? { opacity: 0, y: 0, scale: 0.98 } : { opacity: 1, y: 0, scale: 1 }}
          transition={unlocking ? { duration: 0.35, ease: PREMIUM_EASE } : AUTH_CARD_MOTION.transition}
        >
          {showPicker ? (
            <div className="flex flex-col items-center gap-6 sm:gap-11">
              <AuthScreenHeader title="Who's Signing In?" subtitle="Choose your account to continue." />
              <div className="flex w-full flex-col gap-2">
                {activeWorkspaceMembers.map((member) => (
                  <button
                    key={member.id}
                    type="button"
                    onClick={() => switchUser(member.id)}
                    className="flex items-center gap-3 rounded-xl border border-border/60 bg-background/40 px-4 py-3 text-left transition-colors hover:border-primary/40 hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary dark:border-white/10"
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
            <div className="flex flex-col items-center gap-6 sm:gap-11">
              <AuthScreenHeader
                title={newPinPhase === 'create' ? 'Set a New PIN' : 'Confirm Your New PIN'}
                subtitle={newPinPhase === 'create' ? 'For your security, choose a new 4-digit PIN for this device.' : 'Re-enter your new PIN to confirm.'}
              />
              <PinPad value={newPinValue} onChange={handleNewPinComplete} length={PIN_LENGTH} error={newPinError} disabled={newPinBusy} />
            </div>
          ) : showEmailLogin ? (
            <div className="flex flex-col items-center gap-6 sm:gap-11">
              <AuthScreenHeader title="Log In" subtitle="Use your email and password instead of your PIN." />
              <LogInWithEmailForm onSuccess={handleEmailLoginSuccess} />
              <button
                type="button"
                onClick={() => setShowEmailLogin(false)}
                className="rounded-md px-2 py-1 text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                Back to PIN
              </button>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-6 sm:gap-11">
              <AuthScreenHeader
                title="Enter Your PIN"
                subtitle={isLockedOut ? `Too many attempts. Try again in ${lockoutSecondsLeft}s.` : `Use your 4-digit PIN to continue${currentMember && activeWorkspaceMembers.length > 1 ? ` as ${currentMember.name}` : ''}.`}
              />

              <PinPad value={pin} onChange={setPin} length={PIN_LENGTH} error={error} success={unlocking} disabled={isLockedOut || (busy && !error)} />

              <div className="flex w-full flex-col items-center gap-2 border-t border-border/60 pt-2.5 dark:border-white/10 sm:gap-4 sm:pt-7">
                {canUseBiometrics && !isLockedOut && (
                  <button
                    type="button"
                    onClick={handleBiometrics}
                    disabled={busy}
                    className="flex items-center gap-1.5 rounded-md px-2 py-1 text-sm font-medium text-primary-700 transition-colors hover:text-primary-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary dark:text-primary-300 dark:hover:text-primary-200"
                  >
                    <Fingerprint className="h-4 w-4" aria-hidden="true" />
                    Use Biometrics
                  </button>
                )}
                {activeWorkspaceMembers.length > 1 && (
                  <button
                    type="button"
                    onClick={logout}
                    className="flex items-center gap-1.5 rounded-md px-2 py-1 text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  >
                    <ArrowLeftRight className="h-3.5 w-3.5" aria-hidden="true" />
                    Switch User
                  </button>
                )}
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setShowEmailLogin(true)}
                    className="rounded-md px-2 py-1 text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  >
                    Log in with email
                  </button>
                  <span className="text-border" aria-hidden="true">·</span>
                  <button
                    type="button"
                    onClick={() => setForgotOpen(true)}
                    className="rounded-md px-2 py-1 text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  >
                    Forgot PIN
                  </button>
                </div>
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
