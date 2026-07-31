import { useTheme } from '@/components/theme/ThemeProvider'

// Categorical palette (fixed order — never cycled/reassigned per filter).
// Slot 0 is the brand teal, since it doubles as the default single-series
// color across the dashboard/report charts; slots 1-7 are an accessible,
// visually distinct set chosen to stay legible alongside it.
const CATEGORICAL_LIGHT = ['#12a2a3', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#4a3aa7', '#e34948']
const CATEGORICAL_DARK = ['#29dde0', '#d95926', '#199e70', '#c98500', '#d55181', '#008300', '#9085e9', '#e66767']

const SEQUENTIAL_TEAL_LIGHT = ['#d0f4f4', '#91e2e3', '#3fbcbd', '#12a2a3', '#0b6465']
const SEQUENTIAL_TEAL_DARK = ['#0b6465', '#12a2a3', '#29dde0', '#7aeaeb', '#c4f5f5']

export const CHART_CHROME_LIGHT = {
  surface: '#fcfcfb',
  textPrimary: '#0b0b0b',
  textSecondary: '#52514e',
  muted: '#898781',
  grid: '#e1e0d9',
  axis: '#c3c2b7',
  good: '#006300',
}

export const CHART_CHROME_DARK = {
  surface: '#1a1a19',
  textPrimary: '#ffffff',
  textSecondary: '#c3c2b7',
  muted: '#898781',
  grid: '#2c2c2a',
  axis: '#383835',
  good: '#0ca30c',
}

export function useChartColors() {
  const { resolvedTheme } = useTheme()
  const dark = resolvedTheme === 'dark'
  return {
    categorical: dark ? CATEGORICAL_DARK : CATEGORICAL_LIGHT,
    sequentialTeal: dark ? SEQUENTIAL_TEAL_DARK : SEQUENTIAL_TEAL_LIGHT,
    chrome: dark ? CHART_CHROME_DARK : CHART_CHROME_LIGHT,
  }
}
