import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(value: number, currency = 'USD') {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
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
