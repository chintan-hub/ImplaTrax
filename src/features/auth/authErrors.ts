import { isAuthApiError, isAuthRetryableFetchError } from '@supabase/supabase-js'

/**
 * Every auth/onboarding call site funnels its failure through this so the
 * same underlying condition always reads the same way to the user, and a
 * raw Postgres/network/Supabase exception never reaches the UI verbatim.
 * Keyed on Supabase's documented error `code` first (stable across wording
 * changes) and falls back to `message` substring checks for the handful of
 * cases — e.g. the "existing email" signUp response — that don't carry one.
 */
export function describeAuthError(err: unknown): string {
  if (isAuthRetryableFetchError(err) || (err instanceof TypeError && /fetch/i.test(err.message))) {
    return 'Network error — check your internet connection and try again.'
  }

  if (isAuthApiError(err)) {
    switch (err.code) {
      case 'user_already_exists':
      case 'email_exists':
        return 'An account with this email already exists. Please sign in instead.'
      case 'invalid_credentials':
        return 'Incorrect email or password.'
      case 'session_expired':
      case 'session_not_found':
      case 'refresh_token_not_found':
      case 'refresh_token_already_used':
        return 'Your session has expired. Please sign in again.'
      case 'email_not_confirmed':
        return 'Check your email to confirm your account, then log in.'
      case 'over_request_rate_limit':
      case 'over_email_send_rate_limit':
        return 'Too many attempts. Please wait a moment and try again.'
      case 'weak_password':
        return 'Please choose a stronger password.'
    }
    if (err.message === 'User already registered') {
      return 'An account with this email already exists. Please sign in instead.'
    }
    if (err.message === 'Invalid login credentials') {
      return 'Incorrect email or password.'
    }
    if (err.status && err.status >= 500) {
      return 'Something went wrong on our end. Please try again in a moment.'
    }
    return err.message
  }

  if (err instanceof Error) return err.message
  return 'Something went wrong. Please try again.'
}

/** True when a signUp() call failed specifically because the email is already registered (confirm-email-disabled projects surface this as a normal error, not the obfuscated-user response below). */
export function isEmailAlreadyRegisteredError(err: unknown): boolean {
  if (!isAuthApiError(err)) return false
  return err.code === 'user_already_exists' || err.code === 'email_exists' || err.message === 'User already registered'
}

/**
 * True when signUp() "succeeded" but the response is Supabase's documented
 * obfuscated-user signal for an already-registered email (confirm-email-
 * enabled projects never return a real error here, to avoid leaking which
 * addresses are registered) — a real new signup has at least one identity.
 */
export function isObfuscatedExistingUserSignUp(data: { user: { identities?: unknown[] | null } | null; session: unknown }): boolean {
  return Boolean(data.user) && !data.session && Array.isArray(data.user?.identities) && data.user!.identities!.length === 0
}
