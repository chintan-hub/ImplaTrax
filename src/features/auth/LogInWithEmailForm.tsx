import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { PasswordInput } from '@/components/ui/password-input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { useAuth } from './AuthContext'
import { getRememberedEmail, setRememberedEmail } from './rememberedEmail'
import { AUTH_INPUT_CLASS, CTA_BUTTON_CLASS } from './authTheme'

/**
 * The "existing user" half of the entry screen — shared between the
 * onboarding welcome step and LoginScreen's "Log in with email instead"
 * fallback, so the two never drift out of sync.
 */
export function LogInWithEmailForm({ initialEmail, onSuccess }: { initialEmail?: string; onSuccess: (needsNewPin: boolean) => void }) {
  const { logInWithPassword, requestPasswordReset } = useAuth()
  const [email, setEmail] = useState(() => initialEmail?.trim() || getRememberedEmail())
  const [password, setPassword] = useState('')
  const [remember, setRemember] = useState(() => Boolean(getRememberedEmail()))
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [forgotOpen, setForgotOpen] = useState(false)
  const [resetEmail, setResetEmail] = useState('')
  const [resetSending, setResetSending] = useState(false)
  const [resetSent, setResetSent] = useState(false)
  const [resetError, setResetError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setBusy(true)
    const result = await logInWithPassword(email, password)
    setBusy(false)
    if (result.ok === false) {
      setError(result.error)
      return
    }
    if (result.ok === 'pending-confirmation') {
      setError('Check your email to confirm your account, then log in.')
      return
    }
    setRememberedEmail(remember ? email.trim() : null)
    onSuccess(result.needsNewPin)
  }

  const openForgotPassword = () => {
    setResetEmail(email.trim())
    setResetSent(false)
    setResetError('')
    setForgotOpen(true)
  }

  const handleSendReset = async () => {
    if (!resetEmail.trim()) {
      setResetError('Enter your email address.')
      return
    }
    setResetSending(true)
    setResetError('')
    const result = await requestPasswordReset(resetEmail.trim())
    setResetSending(false)
    if (!result.ok) {
      setResetError(result.error)
      return
    }
    setResetSent(true)
  }

  return (
    <form onSubmit={handleSubmit} className="flex w-full flex-col gap-3 sm:gap-4">
      <div className="flex flex-col gap-1.5 sm:gap-2">
        <Label htmlFor="login-email">Email</Label>
        <Input
          id="login-email"
          type="email"
          autoComplete="email"
          autoFocus
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          className={AUTH_INPUT_CLASS}
        />
      </div>
      <div className="flex flex-col gap-1.5 sm:gap-2">
        <Label htmlFor="login-password">Password</Label>
        <PasswordInput
          id="login-password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className={AUTH_INPUT_CLASS}
        />
      </div>

      {error && <p className="text-sm text-danger-600">{error}</p>}

      <div className="flex items-center justify-between text-sm">
        <label className="flex items-center gap-1.5 text-muted-foreground">
          <input
            type="checkbox"
            checked={remember}
            onChange={(e) => setRemember(e.target.checked)}
            className="h-3.5 w-3.5 rounded border-border/70 text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          />
          Remember me
        </label>
        <button type="button" onClick={openForgotPassword} className="text-muted-foreground transition-colors hover:text-foreground">
          Forgot password?
        </button>
      </div>

      <Button type="submit" size="lg" className={`w-full ${CTA_BUTTON_CLASS}`} loading={busy} disabled={!email.trim() || !password}>
        Log In
      </Button>

      <Dialog open={forgotOpen} onOpenChange={setForgotOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Reset your password</DialogTitle>
            <DialogDescription>
              {resetSent
                ? "Check your email for a link to set a new password."
                : "Enter your account email and we'll send you a link to set a new password."}
            </DialogDescription>
          </DialogHeader>
          {!resetSent && (
            <div className="space-y-1.5">
              <Label htmlFor="reset-email">Email</Label>
              <Input
                id="reset-email"
                type="email"
                autoComplete="email"
                autoFocus
                value={resetEmail}
                onChange={(e) => setResetEmail(e.target.value)}
                placeholder="you@example.com"
              />
              {resetError && <p className="text-sm text-danger-600">{resetError}</p>}
            </div>
          )}
          <DialogFooter>
            {resetSent ? (
              <Button onClick={() => setForgotOpen(false)}>Got it</Button>
            ) : (
              <>
                <Button variant="outline" onClick={() => setForgotOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleSendReset} loading={resetSending} disabled={!resetEmail.trim()}>
                  Send Reset Link
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </form>
  )
}
