import { describe, it, expect } from 'vitest'
import { formatCurrency } from './utils'

/** Intl.NumberFormat inserts a non-breaking space (U+00A0) between amount and symbol for some locales — normalize it to a plain space so test expectations stay readable as plain ASCII. */
function normalizeSpaces(s: string) {
  return s.replace(/\u00A0/g, ' ')
}

describe('formatCurrency', () => {
  it('formats USD with the US grouping/decimal conventions', () => {
    expect(formatCurrency(1234567.89, 'USD')).toBe('$1,234,567.89')
  })

  it('formats INR with the Indian numbering system (lakh/crore grouping)', () => {
    expect(formatCurrency(12345678.9, 'INR')).toBe('₹1,23,45,678.90')
  })

  it('formats EUR using its locale convention', () => {
    // de-DE: period for thousands, comma for decimal, symbol after the amount.
    expect(normalizeSpaces(formatCurrency(1234567.89, 'EUR'))).toBe('1.234.567,89 €')
  })

  it('formats GBP using its locale convention', () => {
    expect(formatCurrency(1234567.89, 'GBP')).toBe('£1,234,567.89')
  })

  it('falls back to the browser default locale for an unmapped currency code, without throwing', () => {
    expect(() => formatCurrency(100, 'JPY')).not.toThrow()
    expect(formatCurrency(100, 'JPY')).toContain('100')
  })
})
