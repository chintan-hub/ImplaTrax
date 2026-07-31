import { useEffect, useState } from 'react'
import { motion, useMotionValue, useSpring } from 'framer-motion'
import { cn } from '@/lib/utils'
import screwUrl from '@/assets/screw.png'

interface ScrewBackgroundProps {
  className?: string
  /** True during the brief correct-PIN transition — shrinks and fades the glow instead of drifting. */
  unlocking?: boolean
}

/**
 * Ambient brand texture behind the auth screens — the implant-screw mark
 * from the logo, masked so heavily blurred and so faint it never reads as a
 * literal icon, just a soft teal glow. Tinted with the brand primary (rather
 * than adapting to foreground like the sidebar logo does) since its job here
 * is a deliberate, quiet accent, not a legible mark. Dark mode needs a much
 * lower opacity for the same effect — --primary is a bright, saturated teal
 * there (vs. a deep, dark one in light mode), so the same alpha would read
 * as a clearly legible shape instead of a texture.
 */
export function ScrewBackground({ className, unlocking = false }: ScrewBackgroundProps) {
  const [reducedMotion, setReducedMotion] = useState(false)
  const offsetX = useMotionValue(0)
  const offsetY = useMotionValue(0)
  const springX = useSpring(offsetX, { stiffness: 40, damping: 16, mass: 0.8 })
  const springY = useSpring(offsetY, { stiffness: 40, damping: 16, mass: 0.8 })

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)')
    setReducedMotion(query.matches)
    const listener = () => setReducedMotion(query.matches)
    query.addEventListener('change', listener)
    return () => query.removeEventListener('change', listener)
  }, [])

  useEffect(() => {
    if (unlocking || reducedMotion) return

    const handlePointerMove = (e: PointerEvent) => {
      const nx = (e.clientX / window.innerWidth) * 2 - 1
      const ny = (e.clientY / window.innerHeight) * 2 - 1
      offsetX.set(nx * 8)
      offsetY.set(ny * 8)
    }
    const resetOffset = () => {
      offsetX.set(0)
      offsetY.set(0)
    }
    const handleOrientation = (e: DeviceOrientationEvent) => {
      if (e.gamma == null || e.beta == null) return
      offsetX.set(Math.max(-8, Math.min(8, e.gamma / 3)))
      offsetY.set(Math.max(-8, Math.min(8, (e.beta - 45) / 4)))
    }

    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerleave', resetOffset)
    if ('DeviceOrientationEvent' in window) {
      window.addEventListener('deviceorientation', handleOrientation)
    }
    return () => {
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerleave', resetOffset)
      window.removeEventListener('deviceorientation', handleOrientation)
    }
  }, [offsetX, offsetY, unlocking, reducedMotion])

  return (
    <div className={cn('pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden', className)} aria-hidden="true">
      <motion.div style={{ x: springX, y: springY }} className="h-[min(50vh,50vw)] w-[min(50vh,50vw)] max-w-none">
        <motion.div
          className="h-full w-full"
          animate={unlocking ? { scale: 0.2, opacity: 0 } : reducedMotion ? { opacity: 1 } : { y: [0, -18, 0] }}
          transition={unlocking ? { duration: 0.4, ease: 'easeIn' } : reducedMotion ? undefined : { duration: 10, repeat: Infinity, ease: 'easeInOut' }}
        >
          <div
            className="h-full w-full bg-primary/[0.14] blur-3xl dark:bg-primary/[0.022]"
            style={{
              WebkitMaskImage: `url(${screwUrl})`,
              maskImage: `url(${screwUrl})`,
              WebkitMaskSize: 'contain',
              maskSize: 'contain',
              WebkitMaskRepeat: 'no-repeat',
              maskRepeat: 'no-repeat',
              WebkitMaskPosition: 'center',
              maskPosition: 'center',
            }}
          />
        </motion.div>
      </motion.div>
    </div>
  )
}
