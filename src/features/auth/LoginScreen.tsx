import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Fingerprint } from 'lucide-react'
import { toast } from 'sonner'
import { Logo } from '@/components/brand/Logo'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { BRAND } from '@/content/helpText'
import { useAuth } from './AuthContext'
import { ScrewBackground } from './ScrewBackground'
import { PinPad } from './PinPad'

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
    <div className="relative flex h-screen w-full items-center justify-center overflow-hidden bg-background print:hidden">
      <ScrewBackground unlocking={unlocking} />

      <motion.div
        className="relative z-10 flex flex-col items-center gap-10 px-6"
        animate={unlocking ? { opacity: 0 } : { opacity: 1 }}
        transition={{ duration: 0.35, ease: 'easeOut' }}
      >
        <div className="flex flex-col items-center gap-3">
          <motion.div animate={unlocking ? { scale: 1.08 } : { scale: 1 }} transition={{ duration: 0.3, ease: 'easeOut' }}>
            <Logo className="h-8" />
          </motion.div>
          <p className="text-center text-xs font-medium uppercase tracking-wide text-muted-foreground">{BRAND.tagline}</p>
        </div>

        <PinPad value={pin} onChange={setPin} length={PIN_LENGTH} error={error} disabled={busy && !error} />

        <div className="flex flex-col items-center gap-3">
          {canUseBiometrics && (
            <button
              type="button"
              onClick={handleBiometrics}
              disabled={busy}
              className="flex items-center gap-1.5 text-sm font-medium text-primary-700 transition-colors hover:text-primary-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-md px-2 py-1 dark:text-primary-300 dark:hover:text-primary-200"
            >
              <Fingerprint className="h-4 w-4" aria-hidden="true" />
              Use Biometrics
            </button>
          )}
          <button
            type="button"
            onClick={() => setForgotOpen(true)}
            className="text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-md px-2 py-1"
          >
            Forgot PIN
          </button>
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
