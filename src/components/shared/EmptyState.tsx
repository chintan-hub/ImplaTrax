import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  /** Smaller, border-less treatment for embedding inside a card/widget rather than filling a whole page. */
  compact,
}: {
  icon: LucideIcon
  title: string
  description?: string
  action?: ReactNode
  compact?: boolean
}) {
  if (compact) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-6 text-center">
        <Icon className="h-5 w-5 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">{title}</p>
        {action}
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border py-16 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <p className="text-sm font-medium">{title}</p>
        {description && <p className="mt-1 text-sm text-muted-foreground max-w-sm">{description}</p>}
      </div>
      {action}
    </div>
  )
}
