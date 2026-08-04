import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Logo } from '@/components/brand/Logo'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { PasswordInput } from '@/components/ui/password-input'
import { useAuth } from './AuthContext'
import { AuthShowcasePanel } from './AuthShowcasePanel'
import { AuthScreenHeader } from './AuthScreenHeader'
import { PREMIUM_EASE } from './authTheme'

const CARD_CLASS =
  'relative w-full max-w-md rounded-3xl border border-slate-200/80 bg-white p-6 shadow-2xl shadow-slate-900/10 sm:p-8 ' +
  'dark:border-white/[0.08] dark:bg-slate-900 dark:shadow-black/40'

/**
 * Where a password-recovery email link lands. Supabase's `detectSessionInUrl`
 * parses the link's access token in the URL hash and establishes a temporary
 * recovery session before this component ever mounts, so `updatePassword`
 * just needs a new password — no token handling here. Routed outside
 * AuthGate/DataProvider (see App.tsx) since a bare recovery session has no
 * workspace context to hydrate.
 */
export function ResetPasswordPage() {
  const { updatePassword } = useAuth()
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)

  useEffect(() => {
    if (!done) return
    const timer = setTimeout(() => navigate('/'), 2500)
    return () => clearTimeout(timer)
  }, [done, navigate])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }
    setBusy(true)
    const result = await updatePassword(password)
    setBusy(false)
    if (!result.ok) {
      setError(result.error)
      return
    }
    setDone(true)
  }

  return (
    <div className="relative flex h-screen w-screen flex-col overflow-hidden bg-white dark:bg-slate-950 lg:flex-row print:hidden">
      <AuthShowcasePanel className="flex h-24 w-full shrink-0 sm:h-32 lg:h-full lg:w-[44%] xl:w-[42%]" />

      <div className="relative flex h-full w-full flex-1 flex-col items-center justify-center overflow-y-auto px-5 py-6 sm:px-8">
        <div className="absolute left-6 top-6 sm:left-8 sm:top-8 lg:left-12 lg:top-8">
          <Logo className="h-7 w-auto dark:brightness-110 sm:h-8" />
        </div>

        <motion.div
          className={CARD_CLASS}
          initial={{ opacity: 0, y: 14, scale: 0.99 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.5, ease: PREMIUM_EASE }}
        >
          {done ? (
            <div className="flex flex-col items-center gap-5 sm:gap-7">
              <AuthScreenHeader title="Password Updated" subtitle="Your password has been changed. Taking you to sign in..." />
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col items-center gap-5 sm:gap-7">
              <AuthScreenHeader title="Set a New Password" subtitle="Choose a new password for your account." />
              <div className="flex w-full flex-col gap-3 sm:gap-4">
                <div className="flex flex-col gap-1.5 sm:gap-2">
                  <Label htmlFor="new-password">New Password</Label>
                  <PasswordInput
                    id="new-password"
                    autoComplete="new-password"
                    autoFocus
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">At least 8 characters.</p>
                </div>
                <div className="flex flex-col gap-1.5 sm:gap-2">
                  <Label htmlFor="confirm-new-password">Confirm Password</Label>
                  <PasswordInput
                    id="confirm-new-password"
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                  />
                </div>
              </div>

              {error && <p className="text-sm text-danger-600">{error}</p>}

              <Button type="submit" size="lg" className="w-full" loading={busy} disabled={!password || !confirmPassword}>
                Update Password
              </Button>
            </form>
          )}
        </motion.div>
      </div>
    </div>
  )
}
