import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Fingerprint } from 'lucide-react'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { useAuth } from './AuthContext'
import { AuthShowcasePanel } from './AuthShowcasePanel'
import { AuthBrandBlock } from './AuthBrandBlock'
import { PinPad } from './PinPad'
import { AuthScreenHeader } from './AuthScreenHeader'
import { AUTH_BACKDROP_CLASS, AUTH_CARD_CLASS, AUTH_CARD_MOTION, PREMIUM_EASE } from './authTheme'

const PIN_LENGTH = 4
/** Shake + clear duration for a wrong PIN, and the correct-PIN unlock transition — both kept well under the "feel instant" budget. */
const FEEDBACK_MS = 420

export function LoginScreen() {
  const { verifyPin, verifyBiometrics, unlock, resetDevice, hasBiometrics, platformAuthAvailable } = useAuth()
  const [pin, setPin] = useState('')
  const [error, setError] = useState(false)
  const [busy, setBusy] = useState(false)
  const [unlocking, setUnlocking] = useState(false)
  const [forgotOpen, setForgotOpen] = useState(false)

  const canUseBiometrics = hasBiometrics && platformAuthAvailable

  useEffect(() => {
    if (pin.length !== PIN_LENGTH || busy) return
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

  return (
    <div className="relative flex min-h-screen w-full flex-col md:flex-row print:hidden">
      <AuthShowcasePanel
        unlocking={unlocking}
        className="flex h-[26vh] w-full items-center justify-center sm:h-[30vh] md:sticky md:top-0 md:h-screen md:w-[32%] lg:w-[40%]"
      />

      <div
        className={`relative flex w-full flex-1 flex-col items-center gap-11 px-6 py-12 md:w-[68%] md:justify-center lg:w-[60%] ${AUTH_BACKDROP_CLASS}`}
      >
        <AuthBrandBlock pulse={unlocking} />

        <motion.div
          className={AUTH_CARD_CLASS}
          initial={AUTH_CARD_MOTION.initial}
          animate={unlocking ? { opacity: 0, y: 0, scale: 0.98 } : { opacity: 1, y: 0, scale: 1 }}
          transition={unlocking ? { duration: 0.35, ease: PREMIUM_EASE } : AUTH_CARD_MOTION.transition}
        >
          <div className="flex flex-col items-center gap-11">
            <AuthScreenHeader title="Enter Your PIN" subtitle="Use your 4-digit PIN to continue" />

            <PinPad value={pin} onChange={setPin} length={PIN_LENGTH} error={error} success={unlocking} disabled={busy && !error} />

            <div className="flex w-full flex-col items-center gap-4 border-t border-border/60 pt-7 dark:border-white/10">
              {canUseBiometrics && (
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
              <button
                type="button"
                onClick={() => setForgotOpen(true)}
                className="rounded-md px-2 py-1 text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                Forgot PIN
              </button>
            </div>
          </div>
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
