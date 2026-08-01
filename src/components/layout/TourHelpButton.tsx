import { HelpCircle } from 'lucide-react'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip'
import { useTour } from '@/features/tour/TourContext'

/**
 * Restarts the product tour anytime — only offered at md+ where the
 * sidebar (every tour step's target) is actually on screen; below that
 * breakpoint the sidebar lives in a collapsed drawer, so a spotlight tour
 * would be pointing at nothing. Floats on the right edge of the viewport,
 * clear of the sidebar entirely, rather than sitting over it on the left.
 */
export function TourHelpButton() {
  const { startTour } = useTour()

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={startTour}
          aria-label="Help — restart the product tour"
          className="fixed bottom-5 right-5 z-40 hidden h-11 w-11 items-center justify-center rounded-full border border-border bg-card text-foreground shadow-lg transition-transform hover:-translate-y-0.5 hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary md:flex print:hidden"
        >
          <HelpCircle className="h-5 w-5" aria-hidden="true" />
        </button>
      </TooltipTrigger>
      <TooltipContent side="left">Help</TooltipContent>
    </Tooltip>
  )
}
