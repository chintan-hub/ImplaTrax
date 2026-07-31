import { describe, it, expect } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { DataProvider, useData } from '@/store/DataContext'
import { useCurrencyFormat } from './useCurrencyFormat'

function setup() {
  return renderHook(
    () => {
      const currency = useCurrencyFormat()
      const data = useData()
      return { ...currency, updateClinicSettings: data.updateClinicSettings }
    },
    { wrapper: DataProvider },
  )
}

describe('useCurrencyFormat', () => {
  it('formats using the currently configured Settings currency', () => {
    const { result } = setup()
    act(() => result.current.updateClinicSettings({ currency: 'USD' }))
    expect(result.current.format(1234.5)).toBe('$1,234.50')
  })

  it('changing the Settings currency immediately reformats every value — no refresh, no remount, no stale cache', () => {
    const { result } = setup()

    act(() => result.current.updateClinicSettings({ currency: 'USD' }))
    expect(result.current.currency).toBe('USD')
    expect(result.current.format(1000)).toBe('$1,000.00')

    act(() => result.current.updateClinicSettings({ currency: 'INR' }))
    expect(result.current.currency).toBe('INR')
    expect(result.current.format(100000)).toBe('₹1,00,000.00')

    act(() => result.current.updateClinicSettings({ currency: 'EUR' }))
    expect(result.current.currency).toBe('EUR')
    expect(result.current.format(1000).replace(/\u00A0/g, ' ')).toBe('1.000,00 €')

    act(() => result.current.updateClinicSettings({ currency: 'GBP' }))
    expect(result.current.currency).toBe('GBP')
    expect(result.current.format(1000)).toBe('£1,000.00')
  })
})
