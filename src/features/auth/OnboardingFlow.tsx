import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { BRAND } from '@/content/helpText'
import { useAuth } from './AuthContext'
import { ScrewBackground } from './ScrewBackground'
import { PinPad } from './PinPad'
import { AuthScreenHeader } from './AuthScreenHeader'
import { isPlatformAuthenticatorAvailable } from './webauthn'

const PIN_LENGTH = 4

type Step = 'welcome' | 'details' | 'pin'
type PinPhase = 'create' | 'confirm'

/** Slightly taller, more elevated CTA treatment for this flow only — the shared Button component (used app-wide) is untouched. */
const CTA_BUTTON_CLASS = 'h-12 rounded-xl shadow-md'

const fadeStep = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
  transition: { duration: 0.2, ease: 'easeOut' as const },
}

export function OnboardingFlow() {
  const { completeOnboarding } = useAuth()
  const [step, setStep] = useState<Step>('welcome')

  const [workspaceName, setWorkspaceName] = useState('')
  const [name, setName] = useState('')
  const [contact, setContact] = useState('')

  const [pinPhase, setPinPhase] = useState<PinPhase>('create')
  const [createdPin, setCreatedPin] = useState('')
  const [pin, setPin] = useState('')
  const [pinError, setPinError] = useState(false)
  const [enableBiometrics, setEnableBiometrics] = useState(false)
  const [biometricsSupported, setBiometricsSupported] = useState(false)
  const [finishing, setFinishing] = useState(false)

  const detailsValid = workspaceName.trim().length > 0 && name.trim().length > 0 && contact.trim().length > 0
  const [pinConfirmed, setPinConfirmed] = useState(false)

  const handlePinComplete = (value: string) => {
    setPin(value)
    if (value.length !== PIN_LENGTH) return

    if (pinPhase === 'create') {
      setCreatedPin(value)
      setPin('')
      setPinPhase('confirm')
      return
    }

    if (value === createdPin) {
      void isPlatformAuthenticatorAvailable().then(setBiometricsSupported)
      setPinConfirmed(true)
    } else {
      setPinError(true)
      navigator.vibrate?.(30)
      setTimeout(() => {
        setPinError(false)
        setPin('')
        setCreatedPin('')
        setPinPhase('create')
      }, 420)
    }
  }

  const handleFinish = async () => {
    setFinishing(true)
    try {
      await completeOnboarding({ workspaceName: workspaceName.trim(), name: name.trim(), contact: contact.trim(), pin: createdPin, enableBiometrics })
    } catch {
      toast.error('Something went wrong finishing setup', { description: 'Please try again.' })
      setFinishing(false)
    }
  }

  return (
    <div className="relative flex h-screen w-full flex-col items-center overflow-hidden bg-background px-6 pt-[12vh] print:hidden">
      <ScrewBackground />

      <div className="relative z-10 w-full max-w-sm">
        <AnimatePresence mode="wait">
          {step === 'welcome' && (
            <motion.div key="welcome" {...fadeStep} className="flex flex-col items-center gap-12">
              <AuthScreenHeader title="Welcome to ImplaTrax" subtitle={BRAND.tagline} />
              <Button size="lg" className={`w-full ${CTA_BUTTON_CLASS}`} onClick={() => setStep('details')}>
                Create Workspace
              </Button>
            </motion.div>
          )}

          {step === 'details' && (
            <motion.div key="details" {...fadeStep} className="flex flex-col items-center gap-10">
              <AuthScreenHeader title="Set Up Your Workspace" subtitle="Tell us a little about your practice." />
              <div className="flex w-full flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="workspaceName">Workspace Name</Label>
                  <Input id="workspaceName" autoFocus value={workspaceName} onChange={(e) => setWorkspaceName(e.target.value)} placeholder="Your clinic or lab name" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="yourName">Your Name</Label>
                  <Input id="yourName" value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="contact">Mobile Number or Email</Label>
                  <Input id="contact" value={contact} onChange={(e) => setContact(e.target.value)} placeholder="you@example.com" />
                </div>
              </div>
              <Button size="lg" className={`w-full ${CTA_BUTTON_CLASS}`} disabled={!detailsValid} onClick={() => setStep('pin')}>
                Continue
              </Button>
            </motion.div>
          )}

          {step === 'pin' && !pinConfirmed && (
            <motion.div key="pin" {...fadeStep} className="flex flex-col items-center gap-12">
              <AuthScreenHeader
                title={pinPhase === 'create' ? 'Create Your PIN' : 'Confirm Your PIN'}
                subtitle={pinPhase === 'create' ? 'Choose a 4-digit PIN to secure your workspace.' : 'Re-enter your PIN to confirm.'}
              />
              <PinPad value={pin} onChange={handlePinComplete} length={PIN_LENGTH} error={pinError} />
            </motion.div>
          )}

          {step === 'pin' && pinConfirmed && (
            <motion.div key="finish" {...fadeStep} className="flex flex-col items-center gap-10">
              <AuthScreenHeader title="You're All Set" subtitle="Your workspace is ready to use." />
              {biometricsSupported && (
                <div className="flex w-full items-center justify-between rounded-lg border border-border bg-surface px-4 py-3">
                  <div>
                    <p className="text-sm font-medium text-foreground">Enable Biometrics</p>
                    <p className="text-xs text-muted-foreground">Unlock with Face ID, Touch ID, or Windows Hello.</p>
                  </div>
                  <Switch checked={enableBiometrics} onCheckedChange={setEnableBiometrics} aria-label="Enable biometrics" />
                </div>
              )}
              <Button size="lg" className={`w-full ${CTA_BUTTON_CLASS}`} loading={finishing} onClick={handleFinish}>
                Finish
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
