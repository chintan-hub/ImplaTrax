import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Fingerprint } from 'lucide-react'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { BRAND } from '@/content/helpText'
import { useAuth } from './AuthContext'
import { ScrewBackground } from './ScrewBackground'
import { PinPad } from './PinPad'
import { AuthScreenHeader } from './AuthScreenHeader'

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
    <div className="relative flex h-screen w-full flex-col items-center overflow-hidden bg-background px-6 pt-[10vh] print:hidden">
      <ScrewBackground unlocking={unlocking} />

      <motion.div
        className="relative z-10 w-full max-w-sm rounded-2xl border border-border/50 bg-muted/60 px-8 py-11 shadow-elevated backdrop-blur-xl dark:border-white/[0.08] dark:bg-white/[0.03] sm:px-10"
        animate={unlocking ? { opacity: 0, scale: 0.98 } : { opacity: 1, scale: 1 }}
        transition={{ duration: 0.35, ease: 'easeOut' }}
      >
        <div className="flex flex-col items-center gap-11">
          <AuthScreenHeader title="Enter Your PIN" subtitle={BRAND.tagline} pulseLogo={unlocking} />

          <PinPad value={pin} onChange={setPin} length={PIN_LENGTH} error={error} disabled={busy && !error} />

          <div className="flex w-full flex-col items-center gap-4 border-t border-border/60 pt-6 dark:border-white/10">
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
