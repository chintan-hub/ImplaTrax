import { useEffect, useMemo, useState } from 'react'
import { motion, useMotionValue, useSpring } from 'framer-motion'
import { cn } from '@/lib/utils'
import { AUTH_SHOWCASE_BG_CLASS } from './authTheme'
import screwUrl from '@/assets/screw.png'

interface AuthShowcasePanelProps {
  className?: string
  /** True during the brief correct-PIN unlock transition — shrinks and fades the artwork instead of drifting. */
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

interface Particle {
  id: number
  left: number
  top: number
  size: number
  duration: number
  delay: number
}

function buildParticles(): Particle[] {
  return Array.from({ length: 10 }, (_, i) => ({
    id: i,
    left: 12 + ((i * 37) % 76),
    top: 8 + ((i * 53) % 84),
    size: 2 + (i % 3),
    duration: 6 + (i % 5),
    delay: i * 0.4,
  }))
}

/**
 * The showcase side of the split auth layout: a fixed dark teal/navy stage
 * that carries the implant-screw brand mark as a large, clearly-visible
 * hero graphic — not a faint watermark. Built from the same flat alpha-mask
 * silhouette used elsewhere, given the illusion of a lit 3D object purely
 * with layered CSS: a soft ambient glow (slowly pulsing, never static), a
 * top-lit gradient base coat, and a small crisp offset rim-light layer, plus
 * a grounding floor shadow and a scattering of slowly drifting particles for
 * atmosphere. Visible at every breakpoint — shrunk to a shallow banner
 * above the content on mobile rather than hidden, so branding and artwork
 * stay part of the composition everywhere (see the className each screen
 * passes in for the exact per-breakpoint size/position).
 */
export function AuthShowcasePanel({ className, unlocking = false }: AuthShowcasePanelProps) {
  const [reducedMotion, setReducedMotion] = useState(false)
  const particles = useMemo(buildParticles, [])
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
      offsetX.set(nx * 10)
      offsetY.set(ny * 10)
    }
    const resetOffset = () => {
      offsetX.set(0)
      offsetY.set(0)
    }
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
    <div className={cn('relative overflow-hidden', AUTH_SHOWCASE_BG_CLASS, className)} aria-hidden="true">
      {!reducedMotion &&
        particles.map((p) => (
          <motion.span
            key={p.id}
            className="absolute rounded-full bg-primary-200/40 blur-[1px]"
            style={{ left: `${p.left}%`, top: `${p.top}%`, width: p.size, height: p.size }}
            animate={{ y: [0, -16, 0], opacity: [0.15, 0.55, 0.15] }}
            transition={{ duration: p.duration, repeat: Infinity, ease: 'easeInOut', delay: p.delay }}
          />
        ))}

      <motion.div
        style={{ x: springX, y: springY }}
        className="relative h-[18vh] w-[18vh] max-w-[42%] sm:h-[20vh] sm:w-[20vh] md:h-[46vh] md:w-[46vh] lg:h-[58vh] lg:w-[58vh]"
      >
        {/* floor shadow — grounds the mark instead of letting it float free */}
        <div className="absolute inset-x-[18%] bottom-[3%] h-8 rounded-full bg-black/50 blur-xl" />

        {/* far halo — a second, wider, fainter ring of glow further out for extra depth behind the ambient glow */}
        <div className="absolute inset-0 scale-125 bg-primary-500/15 blur-[64px]" style={maskStyle} />

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
          {/* ambient glow — a slow pulse so the whole mark feels gently alive rather than a static sticker */}
          <motion.div
            className="absolute inset-0 scale-110 bg-primary-500/30 blur-3xl"
            style={maskStyle}
            animate={reducedMotion ? undefined : { opacity: [0.75, 1, 0.75] }}
            transition={reducedMotion ? undefined : { duration: 6, repeat: Infinity, ease: 'easeInOut' }}
          />
          {/* base coat — lit-from-above gradient fill so the mark reads as dimensional, not a flat silhouette */}
          <div className="absolute inset-0 bg-gradient-to-b from-primary-200 via-primary-500 to-primary-800" style={maskStyle} />
          {/* rim light — crisp offset highlight implying a light source up-left */}
          <div className="absolute inset-[6%] -translate-x-2 -translate-y-2 bg-white/50 blur-md" style={maskStyle} />
        </motion.div>
      </motion.div>
    </div>
  )
}
