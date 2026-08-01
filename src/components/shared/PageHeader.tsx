import type { ReactNode } from 'react'
import { TermHint } from '@/components/ui/help-tooltip'
import type { TermKey } from '@/content/helpText'

export function PageHeader({
  title,
  description,
  actions,
  helpTerm,
}: {
  title: string
  description?: string
  actions?: ReactNode
  /** Attaches a term explanation next to the page title, looked up from the central registry. */
  helpTerm?: TermKey
}) {
  return (
    <div className="z-20 flex flex-col gap-4 bg-background pb-6 sm:sticky sm:top-0 sm:min-h-[104px] sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 className="flex items-center gap-1.5 text-2xl font-semibold tracking-tight">
          {title}
          {helpTerm && <TermHint term={helpTerm} iconOnly className="text-muted-foreground" />}
        </h1>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}
