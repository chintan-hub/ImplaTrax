import { describe, it, expect, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { DataProvider, useData } from '@/store/DataContext'
import { useCurrencyFormat } from './useCurrencyFormat'

vi.mock('@/features/auth/AuthContext', () => ({
  useAuth: () => ({ currentWorkspace: { id: 'ws-test', name: 'Test Workspace', createdAt: '' }, currentMember: { id: 'member-test', name: 'Tester' } }),
}))

vi.mock('@/lib/supabase/queries', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/supabase/queries')>()
  const { emptyClinicSettings } = await import('@/mocks/settings')
  return {
    ...actual,
    fetchProducts: vi.fn().mockResolvedValue([]),
    fetchMovements: vi.fn().mockResolvedValue([]),
    fetchPurchaseOrders: vi.fn().mockResolvedValue([]),
    fetchVendors: vi.fn().mockResolvedValue([]),
    fetchPatients: vi.fn().mockResolvedValue([]),
    fetchCases: vi.fn().mockResolvedValue([]),
    fetchLabs: vi.fn().mockResolvedValue([]),
    fetchSales: vi.fn().mockResolvedValue([]),
    fetchLoans: vi.fn().mockResolvedValue([]),
    fetchClinicSettings: vi.fn().mockResolvedValue(emptyClinicSettings),
    fetchProductBatches: vi.fn().mockResolvedValue([]),
    fetchDoctors: vi.fn().mockResolvedValue([]),
    fetchManufacturers: vi.fn().mockResolvedValue([]),
    updateClinicSettingsRow: vi.fn().mockResolvedValue(undefined),
  }
})

async function setup() {
  const utils = renderHook(
    () => {
      const currency = useCurrencyFormat()
      const data = useData()
      return { ...currency, updateClinicSettings: data.updateClinicSettings }
    },
    { wrapper: DataProvider },
  )
  // Flush DataProvider's initial per-workspace fetch-all effect before the test starts mutating clinicSettings.
  await act(async () => {})
  return utils
}

describe('useCurrencyFormat', () => {
  it('formats using the currently configured Settings currency', async () => {
    const { result } = await setup()
    await act(async () => {
      await result.current.updateClinicSettings({ currency: 'USD' })
    })
    expect(result.current.format(1234.5)).toBe('$1,234.50')
  })

  it('changing the Settings currency immediately reformats every value — no refresh, no remount, no stale cache', async () => {
    const { result } = await setup()

    await act(async () => {
      await result.current.updateClinicSettings({ currency: 'USD' })
    })
    expect(result.current.currency).toBe('USD')
    expect(result.current.format(1000)).toBe('$1,000.00')

    await act(async () => {
      await result.current.updateClinicSettings({ currency: 'INR' })
    })
    expect(result.current.currency).toBe('INR')
    expect(result.current.format(100000)).toBe('₹1,00,000.00')

    await act(async () => {
      await result.current.updateClinicSettings({ currency: 'EUR' })
    })
    expect(result.current.currency).toBe('EUR')
    expect(result.current.format(1000).replace(/\u00A0/g, ' ')).toBe('1.000,00 €')

    await act(async () => {
      await result.current.updateClinicSettings({ currency: 'GBP' })
    })
    expect(result.current.currency).toBe('GBP')
    expect(result.current.format(1000)).toBe('£1,000.00')
  })
})
