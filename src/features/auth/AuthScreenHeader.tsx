import { motion } from 'framer-motion'
import { Logo } from '@/components/brand/Logo'
import { cn } from '@/lib/utils'

interface AuthScreenHeaderProps {
  title: string
  subtitle: string
  className?: string
  /** Brief scale pulse on the logo only — used during the correct-PIN unlock transition on the login screen. */
  pulseLogo?: boolean
}

/**
 * Shared Logo + Title + Subtitle header used by every auth screen (all
 * onboarding steps and the daily login screen). One shared component keeps
 * the logo size, typography, and spacing pixel-identical everywhere so nothing
 * shifts position as the app moves between screens.
 */
export function AuthScreenHeader({ title, subtitle, className, pulseLogo = false }: AuthScreenHeaderProps) {
  return (
    <div className={cn('flex flex-col items-center gap-2 text-center', className)}>
      <motion.div
        className="mb-4"
        animate={pulseLogo ? { scale: 1.08 } : { scale: 1 }}
        transition={{ duration: 0.3, ease: 'easeOut' }}
      >
        <Logo className="h-10 w-auto" />
      </motion.div>
      <h1 className="text-3xl font-bold tracking-tight text-foreground">{title}</h1>
      <p className="max-w-[15rem] text-[13px] leading-relaxed text-muted-foreground/80">{subtitle}</p>
    </div>
  )
}
