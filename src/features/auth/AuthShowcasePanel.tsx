import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'
import { BRAND } from '@/content/helpText'
import { ImplantMeshCanvas } from './ImplantMeshCanvas'
import logoDark from '@/assets/logo-dark.png'

interface AuthShowcasePanelProps {
  className?: string
  /** True during the brief correct-PIN unlock transition — shrinks and fades the mesh instead of drifting. */
  unlocking?: boolean
}

/**
 * The showcase side of the split auth layout: a fixed obsidian CAD stage —
 * deliberately NOT theme-aware (no dark: variants), a consistent premium
 * backdrop regardless of the user's light/dark toggle, which continues to
 * apply everywhere else including the content panel. Carries a live,
 * cursor-reactive wireframe mesh of an implant screw (ImplantMeshCanvas)
 * rather than a static illustration, plus the brand tagline anchored to the
 * bottom edge.
 */
export function AuthShowcasePanel({ className, unlocking = false }: AuthShowcasePanelProps) {
  const [reducedMotion, setReducedMotion] = useState(false)

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)')
    setReducedMotion(query.matches)
    const listener = () => setReducedMotion(query.matches)
    query.addEventListener('change', listener)
    return () => query.removeEventListener('change', listener)
  }, [])

  return (
    <div
      className={cn(
        'relative overflow-hidden bg-[#080B10]',
        'bg-[radial-gradient(ellipse_70%_55%_at_38%_28%,rgba(2,195,154,0.22),transparent_60%),radial-gradient(ellipse_60%_50%_at_85%_85%,rgba(0,168,150,0.12),transparent_65%)]',
        className,
      )}
      aria-hidden="true"
    >
      {/* faint architectural grid — reinforces the CAD-drafting-table read */}
      <div
        className="absolute inset-0 opacity-[0.07]"
        style={{
          backgroundImage:
            'linear-gradient(rgba(94,234,212,0.7) 1px, transparent 1px), linear-gradient(90deg, rgba(94,234,212,0.7) 1px, transparent 1px)',
          backgroundSize: '48px 48px',
        }}
      />

      <motion.div
        className="absolute inset-0"
        animate={unlocking ? { opacity: 0, scale: 0.85 } : { opacity: 1, scale: 1 }}
        transition={unlocking ? { duration: 0.4, ease: 'easeIn' } : { duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
      >
        <ImplantMeshCanvas className="h-full w-full" reducedMotion={reducedMotion || unlocking} />
      </motion.div>

      {/* bottom vignette + tagline overlay — only on the full-height desktop
          pane. The compact mobile/tablet banner (h-24/h-32, see the
          className each screen passes in) isn't tall enough to hold the
          mesh and two lines of text without them overlapping, so this stays
          decoration-only below lg:. */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 hidden h-40 bg-gradient-to-t from-[#050709] to-transparent lg:block" />

      <motion.div
        className="absolute inset-x-0 bottom-12 hidden flex-col items-center gap-1.5 px-8 text-center lg:flex"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: unlocking ? 0 : 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
      >
        {/* Fixed dark-background wordmark variant — this panel's obsidian
            backdrop never changes with the app's light/dark toggle, so the
            logo asset it shows shouldn't either (the theme-aware <Logo>
            component is what the LoginScreen's top-left mark uses instead). */}
        <img src={logoDark} alt="ImplaTrax" draggable={false} className="h-6 w-auto select-none object-contain sm:h-7" />
        <p className="whitespace-nowrap text-[13px] font-medium tracking-wide text-slate-100/90 lg:text-sm xl:text-base">{BRAND.tagline}</p>
      </motion.div>
    </div>
  )
}
