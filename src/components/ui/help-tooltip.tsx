import * as React from 'react'
import { Info } from 'lucide-react'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { TERMS, ICON_HELP, type TermKey, type IconHelpKey, type HelpEntry } from '@/content/helpText'

/**
 * The single reusable tooltip for the whole app. Works via hover/focus on
 * desktop (native Radix behavior) and via tap on touch devices — Radix's
 * hover/focus events don't fire reliably on touch, so an explicit toggle is
 * wired on top for tap/long-press. Content always renders from a small,
 * predictable shape: a title, an optional one-line description, and an
 * optional keyboard shortcut.
 */
export function HelpTooltip({
  title,
  description,
  shortcut,
  side = 'top',
  children,
}: HelpEntry & { side?: 'top' | 'bottom' | 'left' | 'right'; children: React.ReactElement }) {
  const [open, setOpen] = React.useState(false)

  return (
    <Tooltip open={open} onOpenChange={setOpen} delayDuration={300}>
      <TooltipTrigger
        asChild
        onClick={(e: React.MouseEvent) => {
          // Touch devices deliver a click without a preceding hover — toggle
          // explicitly so tap/long-press reveals the tooltip on mobile.
          e.stopPropagation()
          setOpen((o) => !o)
        }}
      >
        {children}
      </TooltipTrigger>
      <TooltipContent side={side} className="max-w-[240px]">
        <p className="font-medium">{title}</p>
        {description && <p className="mt-0.5 text-background/80">{description}</p>}
        {shortcut && (
          <kbd className="mt-1.5 inline-flex items-center rounded border border-background/20 bg-background/10 px-1 py-0.5 text-[10px]">
            {shortcut}
          </kbd>
        )}
      </TooltipContent>
    </Tooltip>
  )
}

/** Wraps an existing icon/button element with a tooltip looked up from the central icon-help registry. */
export function IconHelp({
  helpKey,
  side,
  children,
}: {
  helpKey: IconHelpKey
  side?: 'top' | 'bottom' | 'left' | 'right'
  children: React.ReactElement
}) {
  const entry: HelpEntry = ICON_HELP[helpKey]
  return (
    <HelpTooltip title={entry.title} description={entry.description} shortcut={entry.shortcut} side={side}>
      {children}
    </HelpTooltip>
  )
}

/**
 * Inline term explainer — renders its label with a subtle dotted underline
 * and a small info glyph. Keyboard-focusable so the tooltip is reachable
 * without a mouse, per accessibility requirements.
 */
export function TermHint({
  term,
  className,
  iconOnly = false,
}: {
  term: TermKey
  className?: string
  /** Show only the (i) glyph, no label text — for tight spaces like table headers. */
  iconOnly?: boolean
}) {
  const entry = TERMS[term]
  return (
    <HelpTooltip title={entry.title} description={entry.description}>
      <button
        type="button"
        className={cn(
          'inline-flex items-center gap-1 rounded-sm align-middle text-inherit',
          !iconOnly && 'border-b border-dotted border-muted-foreground/50 hover:border-muted-foreground',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background',
          'cursor-help',
          className,
        )}
        aria-label={`${entry.title}: ${entry.description}`}
      >
        {!iconOnly && entry.title}
        <Info className="h-3 w-3 shrink-0 text-muted-foreground" aria-hidden="true" />
      </button>
    </HelpTooltip>
  )
}
