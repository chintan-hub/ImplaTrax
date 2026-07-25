import type { LucideIcon } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { TermHint } from '@/components/ui/help-tooltip'
import type { TermKey } from '@/content/helpText'
import { cn } from '@/lib/utils'

export function StatCard({
  label,
  value,
  icon: Icon,
  trend,
  trendLabel,
  tone = 'default',
  onClick,
  helpTerm,
}: {
  label: string
  value: string
  icon: LucideIcon
  trend?: number
  trendLabel?: string
  tone?: 'default' | 'success' | 'warning' | 'danger' | 'accent'
  onClick?: () => void
  /** Attaches a term explanation next to the label, looked up from the central registry. */
  helpTerm?: TermKey
}) {
  const toneClasses: Record<string, string> = {
    default: 'bg-primary/10 text-primary-700 dark:text-primary-300',
    success: 'bg-success/15 text-success-700 dark:text-success-500',
    warning: 'bg-warning/15 text-warning-700 dark:text-warning-500',
    danger: 'bg-danger/15 text-danger-700 dark:text-danger-500',
    accent: 'bg-accent/15 text-accent-700 dark:text-accent-400',
  }

  return (
    <Card
      onClick={onClick}
      className={cn('transition-all', onClick && 'cursor-pointer hover:shadow-elevated hover:-translate-y-0.5')}
    >
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="flex items-center gap-1 text-sm font-medium text-muted-foreground">
              {label}
              {helpTerm && <TermHint term={helpTerm} iconOnly />}
            </p>
            <p className="mt-2 text-2xl font-semibold tracking-tight">{value}</p>
          </div>
          <div className={cn('flex h-9 w-9 items-center justify-center rounded-lg', toneClasses[tone])}>
            <Icon className="h-4.5 w-4.5" />
          </div>
        </div>
        {trend !== undefined && (
          <p className={cn('mt-3 text-xs font-medium', trend >= 0 ? 'text-success-600' : 'text-danger-600')}>
            {trend >= 0 ? '+' : ''}
            {trend}% {trendLabel}
          </p>
        )}
      </CardContent>
    </Card>
  )
}
