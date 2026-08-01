import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { useAuth } from './AuthContext'
import { getRememberedEmail, setRememberedEmail } from './rememberedEmail'
import { AUTH_INPUT_CLASS, CTA_BUTTON_CLASS } from './authTheme'

/**
 * The "existing user" half of the entry screen — shared between the
 * onboarding welcome step and LoginScreen's "Log in with email instead"
 * fallback, so the two never drift out of sync. There is no backend yet:
 * `logInWithPassword` can only match an account that was created on THIS
 * device (see AuthContext.tsx), so a fresh browser will always come back
 * "not found" here — that's expected until Supabase sync lands, and the
 * error message says so honestly rather than pretending otherwise.
 */
export function LogInWithEmailForm({ onSuccess }: { onSuccess: (needsNewPin: boolean) => void }) {
  const { logInWithPassword } = useAuth()
  const [email, setEmail] = useState(() => getRememberedEmail())
  const [password, setPassword] = useState('')
  const [remember, setRemember] = useState(() => Boolean(getRememberedEmail()))
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [forgotOpen, setForgotOpen] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setBusy(true)
    const result = await logInWithPassword(email, password)
    setBusy(false)
    if (!result.ok) {
      setError(result.error)
      return
    }
    setRememberedEmail(remember ? email.trim() : null)
    onSuccess(result.needsNewPin)
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
        <Input
          id="login-password"
          type="password"
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
        <button type="button" onClick={() => setForgotOpen(true)} className="text-muted-foreground transition-colors hover:text-foreground">
          Forgot password?
        </button>
      </div>

      <Button type="submit" size="lg" className={`w-full ${CTA_BUTTON_CLASS}`} loading={busy} disabled={!email.trim() || !password}>
        Log In
      </Button>

      <Dialog open={forgotOpen} onOpenChange={setForgotOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Forgot your password?</DialogTitle>
            <DialogDescription>
              Password reset by email requires cloud sync, which arrives with the Supabase integration. Until then, a workspace
              owner can regain access from "Forgot PIN" on the PIN screen, or a teammate can be re-added by an admin.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={() => setForgotOpen(false)}>Got it</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </form>
  )
}
