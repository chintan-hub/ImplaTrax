import { motion } from 'framer-motion'
import { Logo } from '@/components/brand/Logo'
import { BRAND } from '@/content/helpText'
import { cn } from '@/lib/utils'

interface AuthBrandBlockProps {
  className?: string
  /** Brief scale pulse — played during the correct-PIN unlock transition on the login screen. */
  pulse?: boolean
}

/**
 * The Logo + tagline brand mark, shown once per auth screen above whichever
 * step card is active. Kept outside each step's own AnimatePresence so it
 * never re-mounts or shifts position as onboarding steps swap in and out —
 * only the card below it changes.
 */
export function AuthBrandBlock({ className, pulse = false }: AuthBrandBlockProps) {
  return (
    <div className={cn('flex flex-col items-center gap-3 text-center', className)}>
      <motion.div animate={pulse ? { scale: 1.08 } : { scale: 1 }} transition={{ duration: 0.3, ease: 'easeOut' }}>
        <Logo className="h-14 w-auto sm:h-16 lg:h-[4.5rem]" />
      </motion.div>
      <p className="text-base font-semibold text-primary-600 dark:text-primary-300 sm:text-lg">{BRAND.tagline}</p>
    </div>
  )
}
