import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { TermHint } from '@/components/ui/help-tooltip'
import { useStickyHeader } from '@/hooks/useStickyHeader'
import type { TermKey } from '@/content/helpText'

interface StickyActionHeaderProps {
  title: string
  description?: string
  actions?: ReactNode
  /** Attaches a term explanation next to the page title, looked up from the central registry. */
  helpTerm?: TermKey
  /** Optional search/filter row, rendered inside the same sticky block directly below the title row. */
  toolbar?: ReactNode
  toolbarClassName?: string
}

/**
 * The one sticky action header every major page renders — replaces the old
 * (non-sticky) `PageHeader` + `StickyToolbar` pair. Title/actions and the
 * search/filter toolbar live in a single `position: sticky` block rather
 * than two independently-stuck elements, which is what makes the shrink
 * transition possible without a gap or overlap: there is only ever one
 * `top: 0` sticky box per page, so nothing needs its offset kept in sync
 * with the other's height as it animates.
 *
 * Pages with stat cards above their action row (Sales, Loans, Inventory,
 * Batches, Loan Returns) render those stats *before* this component rather
 * than between the header and the toolbar, for the same reason — stats
 * aren't part of the sticky unit, so they scroll away normally instead of
 * fighting the header for the same sticky slot.
 *
 * The sticky wrapper carries `group` + `data-scrolled` so content passed
 * into `toolbar` (e.g. a page's TabsList) can shrink in step with the title
 * row purely via CSS — see the `group-data-[scrolled=true]:*` variants on
 * TabsList/TabsTrigger in `components/ui/tabs.tsx` — without this component
 * needing to know what's inside `toolbar`.
 */
export function StickyActionHeader({ title, description, actions, helpTerm, toolbar, toolbarClassName }: StickyActionHeaderProps) {
  const { sentinelRef, isScrolled } = useStickyHeader()

  return (
    <>
      <div ref={sentinelRef} aria-hidden="true" className="h-px" />
      <div
        data-scrolled={isScrolled}
        className={cn(
          'group sticky top-0 z-20 -mx-4 mb-6 border-b px-4 transition-colors duration-200 ease-out md:-mx-8 md:px-8',
          isScrolled ? 'border-border/80 bg-background/85 shadow-sm backdrop-blur-md' : 'border-transparent bg-background/0',
        )}
      >
        <div
          className={cn(
            'flex flex-col gap-3 transition-[padding] duration-200 ease-out sm:flex-row sm:items-center sm:justify-between',
            isScrolled ? 'py-2.5' : 'py-5',
          )}
        >
          <div className="flex min-w-0 flex-col gap-1 overflow-visible">
            <h1
              className={cn(
                'flex items-center gap-1.5 font-semibold leading-normal tracking-tight transition-[font-size] duration-200 ease-out',
                isScrolled ? 'text-lg' : 'text-2xl',
              )}
            >
              {title}
              {helpTerm && <TermHint term={helpTerm} iconOnly className="text-muted-foreground" />}
            </h1>
            {description && (
              <div
                className="grid transition-[grid-template-rows] duration-200 ease-out"
                style={{ gridTemplateRows: isScrolled ? '0fr' : '1fr' }}
              >
                {/* overflow-hidden here is the collapse animation's own clipping
                    mechanism (it's what lets the 1fr->0fr row visually shrink to
                    nothing when scrolled) — distinct from the outer title
                    container above, which stays overflow-visible so the
                    subtitle's own text is never clipped while at rest. */}
                <div className="overflow-hidden">
                  <p className="text-sm leading-normal text-muted-foreground">{description}</p>
                </div>
              </div>
            )}
          </div>
          {actions && (
            <div
              className={cn(
                'flex flex-wrap-reverse items-center justify-end gap-2 transition-transform duration-200 ease-out',
                isScrolled && 'origin-right scale-[0.94]',
              )}
            >
              {actions}
            </div>
          )}
        </div>
        {toolbar && (
          <div
            className={cn(
              'flex flex-col gap-3 border-t border-border/70 transition-[padding] duration-300 ease-out sm:flex-row sm:items-center',
              isScrolled ? 'py-1.5' : 'pb-3 pt-3',
              toolbarClassName,
            )}
          >
            {toolbar}
          </div>
        )}
      </div>
    </>
  )
}
