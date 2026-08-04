import { motion } from 'framer-motion'
import { Logo } from '@/components/brand/Logo'
import { BRAND } from '@/content/helpText'
import { cn } from '@/lib/utils'
import { AUTH_BRAND_MOTION } from './authTheme'

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
    <motion.div {...AUTH_BRAND_MOTION} className={cn('flex flex-col items-center gap-2 text-center sm:gap-2', className)}>
      <motion.div animate={pulse ? { scale: 1.08 } : { scale: 1 }} transition={{ duration: 0.3, ease: 'easeOut' }}>
        <Logo className="h-11 w-auto dark:brightness-110 sm:h-14 lg:h-16" />
      </motion.div>
      {/* Hex literal (not a primary-* token) — this must exactly match the brand teal baked into the logo asset, in both themes. */}
      <p className="text-[15px] font-medium text-[#12a2a3] sm:text-base">{BRAND.tagline}</p>
    </motion.div>
  )
}
