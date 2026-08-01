import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { useAuth } from './AuthContext'
import { AuthShowcasePanel } from './AuthShowcasePanel'
import { AuthBrandBlock } from './AuthBrandBlock'
import { PinPad } from './PinPad'
import { AuthScreenHeader } from './AuthScreenHeader'
import { isPlatformAuthenticatorAvailable } from './webauthn'
import {
  AUTH_BACKDROP_CLASS,
  AUTH_CARD_CLASS,
  AUTH_CARD_MOTION,
  AUTH_CONTENT_WRAPPER_CLASS,
  AUTH_INPUT_CLASS,
  AUTH_SHOWCASE_PANEL_CLASS,
  CTA_BUTTON_CLASS,
  STEP_TRANSITION,
} from './authTheme'

const PIN_LENGTH = 4

type Step = 'welcome' | 'details' | 'pin'
type PinPhase = 'create' | 'confirm'

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

  // Each step can differ in height from the last (e.g. "details" is much
  // taller than "welcome") — reset scroll to the top on every step change
  // so the new step's first control always opens already in view, instead
  // of wherever the previous step happened to leave the scroll position.
  const firstMount = useRef(true)
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: firstMount.current ? 'auto' : 'smooth' })
    firstMount.current = false
  }, [step, pinPhase, pinConfirmed])

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
    <div className="relative flex min-h-dvh w-full flex-col md:flex-row print:hidden">
      <AuthShowcasePanel className={AUTH_SHOWCASE_PANEL_CLASS} />

      <div className={`${AUTH_CONTENT_WRAPPER_CLASS} ${AUTH_BACKDROP_CLASS}`}>
        <AuthBrandBlock />

        <motion.div {...AUTH_CARD_MOTION} className={`overflow-hidden ${AUTH_CARD_CLASS}`}>
          <AnimatePresence mode="wait">
            {step === 'welcome' && (
              <motion.div key="welcome" {...STEP_TRANSITION} className="flex flex-col items-center gap-6 sm:gap-11">
                <AuthScreenHeader title="Welcome to ImplaTrax" subtitle="Let's get your workspace set up." />
                <Button size="lg" className={`w-full ${CTA_BUTTON_CLASS}`} onClick={() => setStep('details')}>
                  Create Workspace
                </Button>
              </motion.div>
            )}

            {step === 'details' && (
              <motion.div key="details" {...STEP_TRANSITION} className="flex flex-col items-center gap-6 sm:gap-11">
                <AuthScreenHeader title="Set Up Your Workspace" subtitle="Tell us a little about your practice." />
                <div className="flex w-full flex-col gap-3 sm:gap-5">
                  <div className="flex flex-col gap-1.5 sm:gap-2">
                    <Label htmlFor="workspaceName">Workspace Name</Label>
                    <Input
                      id="workspaceName"
                      autoFocus
                      value={workspaceName}
                      onChange={(e) => setWorkspaceName(e.target.value)}
                      placeholder="Your clinic or lab name"
                      className={AUTH_INPUT_CLASS}
                    />
                  </div>
                  <div className="flex flex-col gap-1.5 sm:gap-2">
                    <Label htmlFor="yourName">Your Name</Label>
                    <Input
                      id="yourName"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Full name"
                      className={AUTH_INPUT_CLASS}
                    />
                  </div>
                  <div className="flex flex-col gap-1.5 sm:gap-2">
                    <Label htmlFor="contact">Mobile Number or Email</Label>
                    <Input
                      id="contact"
                      value={contact}
                      onChange={(e) => setContact(e.target.value)}
                      placeholder="you@example.com"
                      className={AUTH_INPUT_CLASS}
                    />
                  </div>
                </div>
                <Button size="lg" className={`w-full ${CTA_BUTTON_CLASS}`} disabled={!detailsValid} onClick={() => setStep('pin')}>
                  Continue
                </Button>
              </motion.div>
            )}

            {step === 'pin' && !pinConfirmed && (
              <motion.div key="pin" {...STEP_TRANSITION} className="flex flex-col items-center gap-6 sm:gap-11">
                <AuthScreenHeader
                  title={pinPhase === 'create' ? 'Create Your PIN' : 'Confirm Your PIN'}
                  subtitle={pinPhase === 'create' ? 'Choose a 4-digit PIN to secure your workspace.' : 'Re-enter your PIN to confirm.'}
                />
                <PinPad value={pin} onChange={handlePinComplete} length={PIN_LENGTH} error={pinError} />
              </motion.div>
            )}

            {step === 'pin' && pinConfirmed && (
              <motion.div key="finish" {...STEP_TRANSITION} className="flex flex-col items-center gap-6 sm:gap-11">
                <AuthScreenHeader title="You're All Set" subtitle="Your workspace is ready to use." />
                {biometricsSupported && (
                  <div className="flex w-full items-center justify-between rounded-xl border border-border/60 bg-card/60 px-4 py-3 dark:border-white/10">
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
        </motion.div>
      </div>
    </div>
  )
}
