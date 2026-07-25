import { useTheme } from '@/components/theme/ThemeProvider'

// Categorical palette (fixed order — never cycled/reassigned per filter).
const CATEGORICAL_LIGHT = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#4a3aa7', '#e34948']
const CATEGORICAL_DARK = ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181', '#008300', '#9085e9', '#e66767']

const SEQUENTIAL_BLUE_LIGHT = ['#cde2fb', '#9ec5f4', '#5598e7', '#2a78d6', '#184f95']
const SEQUENTIAL_BLUE_DARK = ['#184f95', '#2a78d6', '#3987e5', '#6da7ec', '#b7d3f6']

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
    sequentialBlue: dark ? SEQUENTIAL_BLUE_DARK : SEQUENTIAL_BLUE_LIGHT,
    chrome: dark ? CHART_CHROME_DARK : CHART_CHROME_LIGHT,
  }
}
