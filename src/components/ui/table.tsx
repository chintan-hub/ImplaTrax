import * as React from 'react'
import { cn } from '@/lib/utils'

/**
 * Any ancestor with `overflow-x: auto` also traps `position: sticky` for its
 * descendants in every evergreen browser — even with `overflow-y` left
 * unset or explicitly `clip`, the UA still treats the box as a scroll
 * container and binds sticky positioning to it, not to `<main>` (confirmed
 * empirically: see PR discussion for P3-B). So a wrapper that needs
 * horizontal scroll can never let its sticky `<thead>` bubble up to the
 * page — the two requirements are mutually exclusive on the same element.
 *
 * Rather than leave the header's stickiness "inert" (AUDIT.md item 21 — the
 * old bug, where the wrapper was a scroll container with no bounded height,
 * so it never actually scrolled and the sticky header never visibly did
 * anything), this wrapper is bounded to a real height with real scroll on
 * both axes. That makes the header genuinely, visibly sticky — just
 * relative to the table's own scroll box instead of `<main>` — and it's the
 * same self-contained pattern already proven on the two bounded Reports
 * tables. Preserves horizontal scroll for wide tables (Products, Purchase
 * Orders) with no risk of the header/toolbar shifting sideways underneath
 * it on narrower viewports.
 */
const Table = React.forwardRef<HTMLTableElement, React.HTMLAttributes<HTMLTableElement>>(
  ({ className, ...props }, ref) => (
    <div className="relative max-h-[560px] w-full overflow-auto scrollbar-thin">
      <table ref={ref} className={cn('w-full caption-bottom text-sm', className)} {...props} />
    </div>
  ),
)
Table.displayName = 'Table'

const TableHeader = React.forwardRef<HTMLTableSectionElement, React.HTMLAttributes<HTMLTableSectionElement>>(
  ({ className, ...props }, ref) => (
    <thead ref={ref} className={cn('sticky top-0 z-10 bg-card [&_tr]:border-b [&_tr]:border-border', className)} {...props} />
  ),
)
TableHeader.displayName = 'TableHeader'

const TableBody = React.forwardRef<HTMLTableSectionElement, React.HTMLAttributes<HTMLTableSectionElement>>(
  ({ className, ...props }, ref) => (
    <tbody ref={ref} className={cn('[&_tr:last-child]:border-0', className)} {...props} />
  ),
)
TableBody.displayName = 'TableBody'

const TableFooter = React.forwardRef<HTMLTableSectionElement, React.HTMLAttributes<HTMLTableSectionElement>>(
  ({ className, ...props }, ref) => (
    <tfoot ref={ref} className={cn('border-t border-border bg-muted/50 font-medium', className)} {...props} />
  ),
)
TableFooter.displayName = 'TableFooter'

const TableRow = React.forwardRef<HTMLTableRowElement, React.HTMLAttributes<HTMLTableRowElement>>(
  ({ className, ...props }, ref) => (
    <tr
      ref={ref}
      className={cn(
        'border-b border-border transition-colors hover:bg-surface-hover data-[state=selected]:bg-muted',
        className,
      )}
      {...props}
    />
  ),
)
TableRow.displayName = 'TableRow'

const TableHead = React.forwardRef<HTMLTableCellElement, React.ThHTMLAttributes<HTMLTableCellElement>>(
  ({ className, ...props }, ref) => (
    <th
      ref={ref}
      className={cn(
        'h-10 bg-card px-3 text-left align-middle text-xs font-medium uppercase tracking-wide text-muted-foreground [&:has([role=checkbox])]:pr-0',
        className,
      )}
      {...props}
    />
  ),
)
TableHead.displayName = 'TableHead'

const TableCell = React.forwardRef<HTMLTableCellElement, React.TdHTMLAttributes<HTMLTableCellElement>>(
  ({ className, ...props }, ref) => (
    <td ref={ref} className={cn('px-3 py-2.5 align-middle [&:has([role=checkbox])]:pr-0', className)} {...props} />
  ),
)
TableCell.displayName = 'TableCell'

const TableCaption = React.forwardRef<HTMLTableCaptionElement, React.HTMLAttributes<HTMLTableCaptionElement>>(
  ({ className, ...props }, ref) => (
    <caption ref={ref} className={cn('mt-4 text-sm text-muted-foreground', className)} {...props} />
  ),
)
TableCaption.displayName = 'TableCaption'

export { Table, TableHeader, TableBody, TableFooter, TableHead, TableRow, TableCell, TableCaption }
