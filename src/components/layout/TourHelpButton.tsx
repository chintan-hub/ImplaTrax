import { useState } from 'react'
import { HelpCircle, Compass, BookOpen } from 'lucide-react'
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '@/components/ui/dropdown-menu'
import { UserGuideModal } from '@/components/manual/UserGuideModal'
import { useTour } from '@/features/tour/TourContext'

/**
 * The one floating Help entry point, bottom-right, clear of the sidebar —
 * offers both ways someone might want help: restart the spotlight product
 * tour, or open the User Manual. Only shown at md+ since the tour's targets
 * (the sidebar) aren't on screen below that breakpoint; the manual option
 * would still make sense at any width, but keeping one Help affordance
 * beats a mobile-only second one appearing in a different spot.
 */
export function TourHelpButton() {
  const { startTour } = useTour()
  const [guideOpen, setGuideOpen] = useState(false)

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label="Help"
            className="fixed bottom-5 right-5 z-40 hidden h-11 w-11 items-center justify-center rounded-full border border-border bg-card text-foreground shadow-lg transition-transform hover:-translate-y-0.5 hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary md:flex print:hidden"
          >
            <HelpCircle className="h-5 w-5" aria-hidden="true" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" side="top">
          <DropdownMenuItem onClick={() => setGuideOpen(true)}>
            <BookOpen aria-hidden="true" /> User Manual
          </DropdownMenuItem>
          <DropdownMenuItem onClick={startTour}>
            <Compass aria-hidden="true" /> Restart Product Tour
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <UserGuideModal open={guideOpen} onOpenChange={setGuideOpen} />
    </>
  )
}
