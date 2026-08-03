import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { toast } from 'sonner'
import { Image as ImageIcon, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Combobox } from '@/components/ui/combobox'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import { useAuth } from './AuthContext'
import { useData } from '@/store/DataContext'
import { AuthShowcasePanel } from './AuthShowcasePanel'
import { AuthBrandBlock } from './AuthBrandBlock'
import { PinPad } from './PinPad'
import { AuthScreenHeader } from './AuthScreenHeader'
import { LogInWithEmailForm } from './LogInWithEmailForm'
import { isPlatformAuthenticatorAvailable } from './webauthn'
import { COUNTRIES } from './countries'
import { fileToResizedDataUrl } from '@/lib/imageResize'
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
const DRAFT_KEY = 'implatrax:onboarding:draft:v1'

type Step = 'welcome' | 'account' | 'company' | 'pin'
type PinPhase = 'create' | 'confirm'

interface Draft {
  workspaceName: string
  name: string
  email: string
  companyName: string
  country: string
  currency: string
  logoDataUrl: string
}

const EMPTY_DRAFT: Draft = { workspaceName: '', name: '', email: '', companyName: '', country: '', currency: 'USD', logoDataUrl: '' }

function loadDraft(): Draft {
  try {
    const raw = localStorage.getItem(DRAFT_KEY)
    if (!raw) return EMPTY_DRAFT
    return { ...EMPTY_DRAFT, ...(JSON.parse(raw) as Partial<Draft>) }
  } catch {
    return EMPTY_DRAFT
  }
}

function saveDraft(draft: Draft) {
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(draft))
  } catch {
    // best-effort — losing the draft just means retyping on resume
  }
}

function clearDraft() {
  try {
    localStorage.removeItem(DRAFT_KEY)
  } catch {
    // best-effort, same as above
  }
}

export function OnboardingFlow() {
  const { completeOnboarding, startDemoWorkspace } = useAuth()
  const { updateClinicSettings } = useData()
  const [startingDemo, setStartingDemo] = useState(false)
  const initialDraft = useRef(loadDraft()).current
  // A draft with any data means the wizard was interrupted mid-way — land
  // straight back on the account step, already filled in, instead of
  // making them click through the welcome screen again.
  const hasDraft = Boolean(initialDraft.workspaceName || initialDraft.name || initialDraft.email)
  const [step, setStep] = useState<Step>(hasDraft ? 'account' : 'welcome')
  const [showLogIn, setShowLogIn] = useState(false)
  const [workspaceName, setWorkspaceName] = useState(initialDraft.workspaceName)
  const [name, setName] = useState(initialDraft.name)
  const [email, setEmail] = useState(initialDraft.email)
  const [password, setPassword] = useState('')

  const [companyName, setCompanyName] = useState(initialDraft.companyName)
  const [country, setCountry] = useState(initialDraft.country)
  const [currency, setCurrency] = useState(initialDraft.currency)
  const [logoDataUrl, setLogoDataUrl] = useState(initialDraft.logoDataUrl)

  const [pinPhase, setPinPhase] = useState<PinPhase>('create')
  const [createdPin, setCreatedPin] = useState('')
  const [pin, setPin] = useState('')
  const [pinError, setPinError] = useState(false)
  const [enableBiometrics, setEnableBiometrics] = useState(false)
  const [biometricsSupported, setBiometricsSupported] = useState(false)
  const [finishing, setFinishing] = useState(false)

  const accountValid = workspaceName.trim().length > 0 && name.trim().length > 0 && /\S+@\S+\.\S+/.test(email.trim()) && password.length >= 8
  const [pinConfirmed, setPinConfirmed] = useState(false)

  // Resumable if interrupted: everything except the password (never worth
  // persisting, even briefly) and the PIN (a device secret, not a draft
  // field) is saved as it's typed, so closing the tab mid-wizard and coming
  // back just means retyping the password, not starting over.
  useEffect(() => {
    saveDraft({ workspaceName, name, email, companyName, country, currency, logoDataUrl })
  }, [workspaceName, name, email, companyName, country, currency, logoDataUrl])

  // Each step can differ in height from the last (e.g. "account" is much
  // taller than "welcome") — reset scroll to the top on every step change
  // so the new step's first control always opens already in view, instead
  // of wherever the previous step happened to leave the scroll position.
  const firstMount = useRef(true)
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: firstMount.current ? 'auto' : 'smooth' })
    firstMount.current = false
  }, [step, showLogIn, pinPhase, pinConfirmed])

  const handleLogoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    try {
      setLogoDataUrl(await fileToResizedDataUrl(file))
    } catch {
      toast.error('Could not use that image', { description: 'Try a different file.' })
    }
  }

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
      await completeOnboarding({ workspaceName: workspaceName.trim(), name: name.trim(), contact: email.trim(), password, pin: createdPin, enableBiometrics })
      await updateClinicSettings({ clinicName: companyName.trim() || workspaceName.trim(), country, currency, logoDataUrl })
      clearDraft()
    } catch {
      toast.error('Something went wrong finishing setup', { description: 'Please try again.' })
      setFinishing(false)
    }
  }

  const handleTryDemo = async () => {
    setStartingDemo(true)
    const result = await startDemoWorkspace()
    if (!result.ok) {
      toast.error('Could not start the demo', { description: result.error })
      setStartingDemo(false)
      return
    }
    toast.success('Demo workspace ready', {
      description: `Pre-loaded with sample products, patients, and cases to explore. Your device PIN is ${result.pin} if you need to unlock again.`,
      duration: 15000,
    })
  }

  return (
    <div className="relative flex min-h-dvh w-full flex-col md:flex-row print:hidden">
      <AuthShowcasePanel className={AUTH_SHOWCASE_PANEL_CLASS} />

      <div className={`${AUTH_CONTENT_WRAPPER_CLASS} ${AUTH_BACKDROP_CLASS}`}>
        <AuthBrandBlock />

        <motion.div {...AUTH_CARD_MOTION} className={`overflow-hidden ${AUTH_CARD_CLASS}`}>
          <AnimatePresence mode="wait">
            {step === 'welcome' && !showLogIn && (
              <motion.div key="welcome" {...STEP_TRANSITION} className="flex flex-col items-center gap-6 sm:gap-11">
                <AuthScreenHeader title="Welcome to ImplaTrax" subtitle="Let's get your workspace set up." />
                <div className="flex w-full flex-col gap-3">
                  <Button size="lg" className={`w-full ${CTA_BUTTON_CLASS}`} onClick={() => setStep('account')} disabled={startingDemo}>
                    Create Workspace
                  </Button>
                  <Button size="lg" variant="outline" className="w-full" onClick={handleTryDemo} loading={startingDemo}>
                    Try Demo Instead
                  </Button>
                  <p className="text-center text-xs text-muted-foreground">Instantly explore a workspace pre-loaded with sample data — nothing here affects a real account.</p>
                  <button
                    type="button"
                    onClick={() => setShowLogIn(true)}
                    disabled={startingDemo}
                    className="rounded-md px-2 py-1 text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  >
                    Already have a workspace? Log in
                  </button>
                </div>
              </motion.div>
            )}

            {step === 'welcome' && showLogIn && (
              <motion.div key="login" {...STEP_TRANSITION} className="flex flex-col items-center gap-6 sm:gap-11">
                <AuthScreenHeader title="Log In" subtitle="Sign in with the email and password from your workspace." />
                <LogInWithEmailForm onSuccess={() => {}} />
                <button
                  type="button"
                  onClick={() => setShowLogIn(false)}
                  className="rounded-md px-2 py-1 text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  Back
                </button>
              </motion.div>
            )}

            {step === 'account' && (
              <motion.div key="account" {...STEP_TRANSITION} className="flex flex-col items-center gap-6 sm:gap-11">
                <AuthScreenHeader title="Set Up Your Workspace" subtitle="Tell us a little about your practice." />
                <div className="flex w-full flex-col gap-3 sm:gap-4">
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
                    <Input id="yourName" value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" className={AUTH_INPUT_CLASS} />
                  </div>
                  <div className="flex flex-col gap-1.5 sm:gap-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      autoComplete="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      className={AUTH_INPUT_CLASS}
                    />
                  </div>
                  <div className="flex flex-col gap-1.5 sm:gap-2">
                    <Label htmlFor="password">Password</Label>
                    <Input
                      id="password"
                      type="password"
                      autoComplete="new-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className={AUTH_INPUT_CLASS}
                    />
                    <p className="text-xs text-muted-foreground">At least 8 characters. This is your account password — separate from the 4-digit PIN you'll set up next.</p>
                  </div>
                </div>
                <Button size="lg" className={`w-full ${CTA_BUTTON_CLASS}`} disabled={!accountValid} onClick={() => setStep('company')}>
                  Continue
                </Button>
              </motion.div>
            )}

            {step === 'company' && (
              <motion.div key="company" {...STEP_TRANSITION} className="flex flex-col items-center gap-6 sm:gap-11">
                <AuthScreenHeader title="About Your Practice" subtitle="Optional — you can change all of this later in Settings." />
                <div className="flex w-full flex-col gap-3 sm:gap-4">
                  <div className="flex flex-col gap-1.5 sm:gap-2">
                    <Label htmlFor="companyName">Company Name (optional)</Label>
                    <Input
                      id="companyName"
                      autoFocus
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      placeholder={workspaceName || 'Same as workspace name'}
                      className={AUTH_INPUT_CLASS}
                    />
                  </div>
                  <div className="flex flex-col gap-1.5 sm:gap-2">
                    <Label>Company Logo (optional)</Label>
                    <div className="flex items-center gap-3">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border/70 bg-background/60 dark:bg-black/25">
                        {logoDataUrl ? (
                          <img src={logoDataUrl} alt="Company logo preview" className="h-full w-full object-contain" />
                        ) : (
                          <ImageIcon className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
                        )}
                      </div>
                      <label className="cursor-pointer rounded-md border border-border/70 bg-background/60 px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:border-primary/40 dark:bg-black/25">
                        {logoDataUrl ? 'Replace' : 'Upload'}
                        <input type="file" accept="image/*" className="sr-only" onChange={handleLogoChange} />
                      </label>
                      {logoDataUrl && (
                        <button
                          type="button"
                          onClick={() => setLogoDataUrl('')}
                          aria-label="Remove logo"
                          className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-surface-hover hover:text-foreground"
                        >
                          <X className="h-4 w-4" aria-hidden="true" />
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col gap-1.5 sm:gap-2">
                    <Label>Country</Label>
                    <Combobox
                      options={COUNTRIES.map((c) => ({ value: c, label: c }))}
                      value={country}
                      onChange={setCountry}
                      placeholder="Select country"
                      searchPlaceholder="Search countries..."
                      emptyText="No countries found."
                      triggerAriaLabel="Country"
                      className={AUTH_INPUT_CLASS}
                    />
                  </div>
                  <div className="flex flex-col gap-1.5 sm:gap-2">
                    <Label>Currency</Label>
                    <Select value={currency} onValueChange={setCurrency}>
                      <SelectTrigger className={AUTH_INPUT_CLASS}><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="USD">USD ($)</SelectItem>
                        <SelectItem value="EUR">EUR (€)</SelectItem>
                        <SelectItem value="GBP">GBP (£)</SelectItem>
                        <SelectItem value="INR">INR (₹)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <Button size="lg" className={`w-full ${CTA_BUTTON_CLASS}`} onClick={() => setStep('pin')}>
                  Continue
                </Button>
              </motion.div>
            )}

            {step === 'pin' && !pinConfirmed && (
              <motion.div key="pin" {...STEP_TRANSITION} className="flex flex-col items-center gap-6 sm:gap-11">
                <AuthScreenHeader
                  title={pinPhase === 'create' ? 'Create Your PIN' : 'Confirm Your PIN'}
                  subtitle={pinPhase === 'create' ? 'Choose a 4-digit PIN to secure your workspace on this device.' : 'Re-enter your PIN to confirm.'}
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
