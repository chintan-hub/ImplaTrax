import { useEffect, useState } from 'react'
import { motion, useMotionValue, useSpring } from 'framer-motion'
import { cn } from '@/lib/utils'
import screwUrl from '@/assets/screw.png'

interface ScrewBackgroundProps {
  className?: string
  /** True during the brief correct-PIN transition — shrinks and fades the screw instead of floating. */
  unlocking?: boolean
}

/**
 * Large, very-low-opacity decorative screw silhouette behind the auth
 * screens — the same implant-screw mark that stands in for the "I" in the
 * logo, extracted once (src/assets/screw.png) and reused here as a CSS mask
 * so its color always matches the current theme (foreground at ~3% opacity,
 * softened with a slight blur) instead of shipping separate light/dark image
 * variants.
 */
export function ScrewBackground({ className, unlocking = false }: ScrewBackgroundProps) {
  const [reducedMotion, setReducedMotion] = useState(false)
  const offsetX = useMotionValue(0)
  const offsetY = useMotionValue(0)
  const springX = useSpring(offsetX, { stiffness: 55, damping: 14, mass: 0.6 })
  const springY = useSpring(offsetY, { stiffness: 55, damping: 14, mass: 0.6 })

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
      offsetX.set(nx * 10)
      offsetY.set(ny * 10)
    }
    const resetOffset = () => {
      offsetX.set(0)
      offsetY.set(0)
    }
    // Passive, permission-free device tilt — works out of the box on Android
    // and most non-iOS browsers. iOS 13+ Safari gates this behind an explicit
    // permission prompt tied to a user gesture, which we deliberately don't
    // add (it would mean a visible button on a screen the brief asks to keep
    // free of clutter) — there the listener just never fires, and the
    // floating loop below is the graceful fallback.
    const handleOrientation = (e: DeviceOrientationEvent) => {
      if (e.gamma == null || e.beta == null) return
      offsetX.set(Math.max(-10, Math.min(10, e.gamma / 3)))
      offsetY.set(Math.max(-10, Math.min(10, (e.beta - 45) / 4)))
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
      <motion.div style={{ x: springX, y: springY }} className="h-[80vh] w-[80vh] max-w-none">
        <motion.div
          className="h-full w-full"
          animate={
            unlocking
              ? { scale: 0.12, opacity: 0 }
              : reducedMotion
                ? { scale: 1, opacity: 1 }
                : { y: [0, -14, 0], rotate: [-2, 2, -2] }
          }
          transition={
            unlocking
              ? { duration: 0.4, ease: 'easeIn' }
              : reducedMotion
                ? undefined
                : { duration: 7, repeat: Infinity, ease: 'easeInOut' }
          }
        >
          <div
            className="h-full w-full bg-foreground/[0.03] blur-sm"
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
