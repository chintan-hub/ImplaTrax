import { useEffect, useState } from 'react'
import { motion, useMotionValue, useSpring } from 'framer-motion'
import { cn } from '@/lib/utils'
import screwUrl from '@/assets/screw.png'

interface ScrewBackgroundProps {
  className?: string
  /** True during the brief correct-PIN transition — shrinks and fades the artwork instead of drifting. */
  unlocking?: boolean
}

const maskStyle = {
  WebkitMaskImage: `url(${screwUrl})`,
  maskImage: `url(${screwUrl})`,
  WebkitMaskSize: 'contain',
  maskSize: 'contain',
  WebkitMaskRepeat: 'no-repeat',
  maskRepeat: 'no-repeat',
  WebkitMaskPosition: 'center',
  maskPosition: 'center',
} as const

/**
 * Signature background artwork for the auth screens — the implant-screw
 * mark from the logo, at a large scale but soft enough that it reads as
 * elegant brand artwork, not a watermark stamped over the content. Two
 * layered copies of the same mask give it a little dimensionality instead
 * of a flat silhouette: a large, heavily-blurred primary-teal "glow" layer,
 * plus a smaller, slightly offset, crisper near-white "rim light" layer —
 * the same trick that makes a rendered 3D object read as dimensional even
 * as a still image (light source implied from one corner).
 *
 * The box is sized with min(vh, vw) rather than a plain vh unit — a large,
 * heavily-blurred shape sized off only one axis gets a hard-edged cutoff
 * where the blur meets the viewport boundary on the *other* axis (very
 * visible on narrow/mobile screens); tying the size to whichever axis is
 * smaller keeps a safe blur-fade margin on every screen size.
 *
 * Anchored near the top of the viewport (matching the card's own fixed
 * offset) rather than centered in the full page — the mark's widest part
 * sits roughly behind the card and its tapering shaft extends below it,
 * so it reads as part of the same composition instead of a separate glow
 * floating underneath.
 */
export function ScrewBackground({ className, unlocking = false }: ScrewBackgroundProps) {
  const [reducedMotion, setReducedMotion] = useState(false)
  const offsetX = useMotionValue(0)
  const offsetY = useMotionValue(0)
  const springX = useSpring(offsetX, { stiffness: 35, damping: 16, mass: 0.9 })
  const springY = useSpring(offsetY, { stiffness: 35, damping: 16, mass: 0.9 })

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
    <div
      className={cn('pointer-events-none absolute inset-0 flex items-start justify-center overflow-hidden pt-[9vh]', className)}
      aria-hidden="true"
    >
      <motion.div style={{ x: springX, y: springY }} className="h-[min(65vh,70vw)] w-[min(65vh,70vw)] max-w-none">
        <motion.div
          className="relative h-full w-full"
          animate={
            unlocking
              ? { scale: 0.2, opacity: 0, rotate: 0 }
              : reducedMotion
                ? { opacity: 1 }
                : { y: [0, -20, 0], rotate: [-2.5, 2.5, -2.5] }
          }
          transition={
            unlocking
              ? { duration: 0.4, ease: 'easeIn' }
              : reducedMotion
                ? undefined
                : { duration: 16, repeat: Infinity, ease: 'easeInOut' }
          }
        >
          {/* base glow — large, heavily blurred, brand teal */}
          <div className="absolute inset-0 bg-primary/[0.14] blur-3xl dark:bg-primary/[0.05]" style={maskStyle} />
          {/* rim light — smaller, crisper, offset up-left to imply a light source and give the mark some dimensionality */}
          <div
            className="absolute inset-[8%] -translate-x-3 -translate-y-3 bg-white/[0.35] blur-xl dark:bg-white/[0.06]"
            style={maskStyle}
          />
        </motion.div>
      </motion.div>
    </div>
  )
}
