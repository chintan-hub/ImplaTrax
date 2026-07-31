import { useTheme } from '@/components/theme/ThemeProvider'
import { cn } from '@/lib/utils'
import logoLight from '@/assets/logo.png'
import logoDark from '@/assets/logo-dark.png'

/** Theme-aware ImplaTrax wordmark. Renders the light- or dark-background logo variant based on the resolved theme. */
export function Logo({ className }: { className?: string }) {
  const { resolvedTheme } = useTheme()
  return (
    <img
      src={resolvedTheme === 'dark' ? logoDark : logoLight}
      alt="ImplaTrax"
      draggable={false}
      className={cn('h-7 w-auto select-none', className)}
    />
  )
}
