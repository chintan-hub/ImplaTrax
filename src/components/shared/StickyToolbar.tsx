import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

/**
 * Wraps a list page's search/filter/action row so it stays visible while
 * scrolling — one shared pattern for every list page (PROJECT.md §2
 * principle 8, USABILITY_BACKLOG.md item 1 / DEVELOPMENT_PLAN.md M17),
 * not a per-page CSS copy. Sticks to the top of the app's single scroll
 * container (`<main>` in AppLayout), directly below the sticky PageHeader
 * (P3-A) every page using this toolbar also has.
 *
 * The 104px offset is a pragmatic fixed value, not an auto-measured one —
 * it matches PageHeader's own `min-h-[104px]` (also P3-A), so the two
 * always meet with no gap and no overlap at `sm:` and above. Below `sm`,
 * neither this toolbar nor PageHeader stick at all — the header's mobile
 * column layout has a variable, taller height this fixed offset can't
 * account for; real responsive handling is P3-C's job. P4-A generalizes
 * this whole thing into a real auto-measuring stack so the hardcoded
 * number goes away entirely.
 */
export function StickyToolbar({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('z-10 mb-5 flex flex-col gap-3 border-b border-border bg-background py-3 sm:sticky sm:top-[104px] sm:flex-row sm:items-center', className)}>
      {children}
    </div>
  )
}
