import { NavLink, useMatch } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { IconHelp } from '@/components/ui/help-tooltip'
import { Logo } from '@/components/brand/Logo'
import { useData } from '@/store/DataContext'
import { NAV_ITEMS, NAV_GROUPS, type NavItem } from './nav'

function SidebarLink({ item, onNavigate }: { item: NavItem; onNavigate?: () => void }) {
  // Resolved to a plain string, not react-router's `({isActive}) => ...`
  // function form: items with a helpKey pass `link` through Radix's
  // TooltipTrigger asChild (a Slot), which clones this element and merges
  // its className prop as a string — a function value there gets stringified
  // into the class attribute instead of invoked, silently dropping all
  // layout classes. useMatch lets us compute isActive ourselves up front.
  // item.to may carry a query string (e.g. the Team link into Settings'
  // Workspace tab) — useMatch's `path` only understands a pathname, so it's
  // stripped here; NavLink's `to` still gets the full string with query.
  const [pathname] = item.to.split('?')
  const isActive = Boolean(useMatch({ path: pathname, end: pathname === '/' }))
  const link = (
    <NavLink
      to={item.to}
      end={pathname === '/'}
      onClick={onNavigate}
      data-tour={item.tourId}
      className={cn(
        'flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-sm font-medium transition-colors',
        isActive
          ? 'bg-primary/10 text-primary-700 dark:text-primary-300'
          : 'text-foreground/75 hover:bg-surface-hover hover:text-foreground',
      )}
    >
      <item.icon className="h-4 w-4 shrink-0" />
      <span className="truncate">{item.label}</span>
    </NavLink>
  )
  return item.helpKey ? (
    <IconHelp helpKey={item.helpKey} side="right">
      {link}
    </IconHelp>
  ) : (
    link
  )
}

export function SidebarBrand() {
  return (
    <div className="flex h-14 items-center px-5 border-b border-border shrink-0">
      <Logo className="h-6" />
    </div>
  )
}

/** The nav link list, shared between the persistent desktop sidebar and the mobile drawer. */
export function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const { clinicSettings } = useData()
  const visibleItems = NAV_ITEMS.filter((item) => !item.requiresBatchLotTracking || clinicSettings.batchLotTrackingEnabled)

  return (
    <nav className="flex-1 overflow-y-auto scrollbar-thin px-3 py-4 space-y-5">
      {NAV_GROUPS.map((group) => (
        <div key={group}>
          <p className="px-2 mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">
            {group}
          </p>
          <div className="space-y-0.5">
            {visibleItems.filter((item) => item.group === group).map((item) => (
              <SidebarLink key={item.to} item={item} onNavigate={onNavigate} />
            ))}
          </div>
        </div>
      ))}
    </nav>
  )
}

export function Sidebar() {
  return (
    <aside className="hidden md:flex w-60 shrink-0 flex-col border-r border-border bg-surface print:hidden">
      <SidebarBrand />
      <SidebarNav />
    </aside>
  )
}
