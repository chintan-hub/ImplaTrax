import { useEffect, useRef, useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { Sidebar } from '@/components/layout/Sidebar'
import { Topbar } from '@/components/layout/Topbar'
import { GlobalSearch } from '@/components/layout/GlobalSearch'
import { TourHelpButton } from '@/components/layout/TourHelpButton'
import { TooltipProvider } from '@/components/ui/tooltip'
import { TourProvider } from '@/features/tour/TourContext'
import { TourOverlay } from '@/features/tour/TourOverlay'
import { WelcomeTourPrompt } from '@/features/tour/WelcomeTourPrompt'

export function AppLayout() {
  const [searchOpen, setSearchOpen] = useState(false)
  const mainRef = useRef<HTMLElement>(null)
  const { pathname } = useLocation()

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setSearchOpen((v) => !v)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  // The app's single scroll container (`<main>`) doesn't reset on route
  // change by default — react-router only auto-handles window scroll, not
  // a custom overflow container — so without this, navigating away from a
  // scrolled page leaves the next page's sticky header rendered in its
  // already-shrunk state with content clipped above it.
  useEffect(() => {
    mainRef.current?.scrollTo({ top: 0 })
  }, [pathname])

  return (
    <TooltipProvider delayDuration={200}>
      <TourProvider>
        <div className="flex h-screen w-full overflow-hidden bg-background text-foreground print:h-auto print:overflow-visible">
          <Sidebar />
          <div className="flex flex-1 flex-col overflow-hidden print:overflow-visible">
            <Topbar onOpenSearch={() => setSearchOpen(true)} />
            <main ref={mainRef} className="flex-1 overflow-y-auto scrollbar-thin print:overflow-visible">
              <div className="mx-auto max-w-[1600px] px-4 py-6 md:px-8 md:py-8 print:max-w-none print:p-0">
                <Outlet />
              </div>
            </main>
          </div>
        </div>
        <GlobalSearch open={searchOpen} onOpenChange={setSearchOpen} />
        <TourHelpButton />
        <TourOverlay />
        <WelcomeTourPrompt />
      </TourProvider>
    </TooltipProvider>
  )
}
