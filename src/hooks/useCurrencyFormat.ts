import { useCallback, useMemo } from 'react'
import { useData } from '@/store/DataContext'
import { formatCurrency } from '@/lib/utils'

/**
 * The single hook every component should use to display money. Reads the
 * workspace's configured currency straight from ClinicSettings (Settings →
 * Clinic → Currency) — the one source of truth — so every consumer
 * re-renders and reformats immediately when it changes, with no refresh,
 * logout, or cache clear required. Never hardcode a currency symbol or call
 * `formatCurrency` with a literal currency in a component; use this instead.
 */
export function useCurrencyFormat() {
  const { clinicSettings } = useData()
  const currency = clinicSettings.currency

  const format = useCallback((value: number) => formatCurrency(value, currency), [currency])

  return useMemo(() => ({ currency, format }), [currency, format])
}
