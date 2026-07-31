import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * The one locale each supported currency is formatted with — this is what
 * actually determines digit grouping (INR's lakh/crore grouping vs. USD/EUR's
 * thousands grouping), decimal separator, and symbol placement. Extend this
 * map, not the currency's formatting call sites, when adding a new currency.
 */
const CURRENCY_LOCALE: Record<string, string> = {
  USD: 'en-US',
  EUR: 'de-DE',
  GBP: 'en-GB',
  INR: 'en-IN',
}

/**
 * The single formatter every monetary value in the app must go through.
 * Currency is a required argument on purpose — there is no default, so a
 * call site can't silently fall back to USD when the workspace is actually
 * configured for something else (that was the root cause of the currency
 * setting not propagating: every call site historically omitted this
 * argument). React components should get `currency` from `useCurrencyFormat`
 * rather than calling this directly, so they automatically stay in sync
 * with Settings; this function itself stays a plain, stateless utility so
 * non-component code (PDF/document builders, tests) can call it directly.
 */
export function formatCurrency(value: number, currency: string) {
  const locale = CURRENCY_LOCALE[currency] ?? undefined
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
  }).format(value)
}

export function formatDate(value: string | Date, opts: Intl.DateTimeFormatOptions = {}) {
  const d = typeof value === 'string' ? new Date(value) : value
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    ...opts,
  }).format(d)
}

export function formatDateTime(value: string | Date) {
  const d = typeof value === 'string' ? new Date(value) : value
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(d)
}

export function initials(name: string) {
  return name
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

export function daysBetween(a: string | Date, b: string | Date = new Date()) {
  const d1 = typeof a === 'string' ? new Date(a) : a
  const d2 = typeof b === 'string' ? new Date(b) : b
  return Math.round((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24))
}

/**
 * Brief artificial delay for form submits and other in-app actions, so a
 * Button's `loading` state is visible instead of flashing instantly. There is
 * no real network here — this exists purely for tactile, production-feeling
 * feedback and to prevent accidental double-submits.
 */
export function simulateLatency(ms = 350) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms))
}
