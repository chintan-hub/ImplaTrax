import { cn } from '@/lib/utils'

interface AuthScreenHeaderProps {
  title: string
  subtitle: string
  className?: string
}

/**
 * Shared Title + Subtitle header used by every auth step card. One shared
 * component keeps the typography and spacing pixel-identical everywhere so
 * nothing shifts as the app moves between screens. The Logo + tagline brand
 * mark lives separately in AuthBrandBlock, shown once above the card rather
 * than repeated inside every step.
 */
export function AuthScreenHeader({ title, subtitle, className }: AuthScreenHeaderProps) {
  return (
    <div className={cn('flex flex-col items-center gap-2 text-center sm:gap-3', className)}>
      <h1 className="text-[1.75rem] font-bold leading-[1.1] tracking-[-0.02em] text-foreground sm:text-[2.25rem]">{title}</h1>
      <p className="max-w-[15rem] text-[13px] leading-relaxed text-muted-foreground/70 dark:text-muted-foreground/85">{subtitle}</p>
    </div>
  )
}
