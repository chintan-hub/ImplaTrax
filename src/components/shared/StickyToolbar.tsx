import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

/**
 * Wraps a list page's search/filter/action row so it stays visible while
 * scrolling — one shared pattern for every list page (PROJECT.md §2
 * principle 8, USABILITY_BACKLOG.md item 1 / DEVELOPMENT_PLAN.md M17),
 * not a per-page CSS copy. Sticks to the top of the app's single scroll
 * container (`<main>` in AppLayout), right below the fixed Topbar.
 */
export function StickyToolbar({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('sticky top-0 z-10 mb-5 flex flex-col gap-3 border-b border-border bg-background py-3 sm:flex-row sm:items-center', className)}>
      {children}
    </div>
  )
}
