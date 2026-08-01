import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { motion } from 'framer-motion'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useTour } from './TourContext'

const SPOT_PADDING = 8
const CARD_WIDTH = 300
const GAP = 16

/**
 * Renders the dimmed backdrop, the highlight ring, and the step tooltip for
 * the active tour. Every step targets persistent app chrome (sidebar/topbar
 * nav items, see tourSteps.ts) rather than page content, so the tour never
 * needs to navigate the user around — it just moves the spotlight, which
 * keeps it fast and never interrupts whatever page they're actually on.
 */
export function TourOverlay() {
  const { active, currentStep, stepIndex, totalSteps, isLastStep, next, previous, exitTour } = useTour()
  const [rect, setRect] = useState<DOMRect | null>(null)

  useEffect(() => {
    if (!active || !currentStep) {
      setRect(null)
      return
    }
    let raf: number
    const tick = () => {
      const el = document.querySelector(currentStep.selector)
      setRect(el ? el.getBoundingClientRect() : null)
      raf = requestAnimationFrame(tick)
    }
    tick()
    return () => cancelAnimationFrame(raf)
  }, [active, currentStep])

  useEffect(() => {
    if (!active) return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') exitTour()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [active, exitTour])

  // A zero-size rect means the target exists in the DOM but isn't visible —
  // e.g. the sidebar collapses into a hidden drawer below md:, where
  // getBoundingClientRect() returns all-zeros rather than null.
  if (!active || !currentStep || !rect || (rect.width === 0 && rect.height === 0)) return null

  const spot = {
    top: rect.top - SPOT_PADDING,
    left: rect.left - SPOT_PADDING,
    width: rect.width + SPOT_PADDING * 2,
    height: rect.height + SPOT_PADDING * 2,
  }

  const fitsRight = spot.left + spot.width + GAP + CARD_WIDTH < window.innerWidth
  const cardTop = fitsRight ? Math.min(spot.top, window.innerHeight - 260) : Math.min(spot.top + spot.height + GAP, window.innerHeight - 260)
  const cardLeft = fitsRight ? spot.left + spot.width + GAP : Math.min(spot.left, window.innerWidth - CARD_WIDTH - GAP)

  return createPortal(
    <div className="fixed inset-0 z-[100]" role="dialog" aria-label={`Product tour: ${currentStep.title}`} aria-modal="true">
      {/* Four panels around the spotlight, rather than a clip-path cutout — simpler to reason about and needs no browser-specific mask support. */}
      <div className="fixed bg-black/60 transition-all duration-200" style={{ top: 0, left: 0, right: 0, height: Math.max(0, spot.top) }} />
      <div className="fixed bg-black/60 transition-all duration-200" style={{ top: spot.top + spot.height, left: 0, right: 0, bottom: 0 }} />
      <div className="fixed bg-black/60 transition-all duration-200" style={{ top: spot.top, left: 0, width: Math.max(0, spot.left), height: spot.height }} />
      <div className="fixed bg-black/60 transition-all duration-200" style={{ top: spot.top, left: spot.left + spot.width, right: 0, height: spot.height }} />
      <motion.div
          key={currentStep.id}
          initial={{ opacity: 0.6 }}
          animate={{ opacity: 1 }}
          className="fixed rounded-lg ring-2 ring-primary shadow-[0_0_0_4px_hsl(var(--primary)/0.2)]"
          style={{ top: spot.top, left: spot.left, width: spot.width, height: spot.height }}
        />
        <motion.div
          key={`card-${currentStep.id}`}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
          className="fixed rounded-xl border border-border bg-card p-4 shadow-2xl"
          style={{ top: cardTop, left: cardLeft, width: CARD_WIDTH }}
        >
        <div className="mb-2 flex items-center justify-between">
          <span className="text-xs font-medium text-muted-foreground">
            Step {stepIndex + 1} of {totalSteps}
          </span>
          <button
            type="button"
            onClick={exitTour}
            aria-label="Close tour"
            className="flex h-6 w-6 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-surface-hover hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </div>
        <h3 className="text-sm font-semibold text-foreground">{currentStep.title}</h3>
        <p className="mt-1 text-sm text-muted-foreground">{currentStep.description}</p>
        <div className="mt-4 flex items-center justify-between">
          <button type="button" onClick={exitTour} className="text-xs font-medium text-muted-foreground transition-colors hover:text-foreground">
            Skip
          </button>
          <div className="flex items-center gap-1.5">
            {stepIndex > 0 && (
              <Button size="sm" variant="outline" onClick={previous}>
                Previous
              </Button>
            )}
            <Button size="sm" onClick={isLastStep ? exitTour : next}>
              {isLastStep ? 'Finish' : 'Next'}
            </Button>
          </div>
        </div>
        </motion.div>
    </div>,
    document.body,
  )
}
