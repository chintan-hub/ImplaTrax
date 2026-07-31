import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, Sun, Moon, Laptop, Plus, ChevronDown, Bell, AlertTriangle, ClipboardList, Menu } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Sheet, SheetContent } from '@/components/ui/sheet'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { IconHelp } from '@/components/ui/help-tooltip'
import { SidebarBrand, SidebarNav } from '@/components/layout/Sidebar'
import { Logo } from '@/components/brand/Logo'
import { useTheme } from '@/components/theme/ThemeProvider'
import { useData } from '@/store/DataContext'
import { currentUser } from '@/mocks/users'
import { BRAND } from '@/content/helpText'
import { initials } from '@/lib/utils'

export function Topbar({ onOpenSearch }: { onOpenSearch: () => void }) {
  const { theme, setTheme } = useTheme()
  const { products, purchaseOrders } = useData()
  const navigate = useNavigate()
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [aboutOpen, setAboutOpen] = useState(false)

  const ThemeIcon = theme === 'light' ? Sun : theme === 'dark' ? Moon : Laptop

  const lowStock = useMemo(
    () => products.filter((p) => p.status === 'active' && p.quantityOnHand <= p.lowStockThreshold),
    [products],
  )
  const pendingPOs = useMemo(
    () => purchaseOrders.filter((po) => ['draft', 'submitted', 'confirmed', 'partially-received'].includes(po.status)),
    [purchaseOrders],
  )
  const alertCount = lowStock.length + pendingPOs.length

  return (
    <header className="flex h-14 items-center gap-2 border-b border-border bg-background/80 backdrop-blur px-3 sm:gap-3 sm:px-4 md:px-6 print:hidden">
      <Button
        variant="ghost"
        size="icon"
        className="shrink-0 md:hidden"
        aria-label="Open navigation menu"
        onClick={() => setMobileNavOpen(true)}
      >
        <Menu className="h-5 w-5" aria-hidden="true" />
      </Button>
      <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
        <SheetContent side="left" className="max-w-64 w-full p-0">
          <SidebarBrand />
          <SidebarNav onNavigate={() => setMobileNavOpen(false)} />
        </SheetContent>
      </Sheet>

      <IconHelp helpKey="search" side="bottom">
        <button
          onClick={onOpenSearch}
          aria-label="Search components, patients, cases and more"
          className="flex flex-1 min-w-0 max-w-md items-center gap-2 rounded-lg border border-border bg-surface px-3 py-1.5 text-sm text-muted-foreground shadow-sm transition-colors hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Search className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span className="flex-1 truncate text-left">
            <span className="hidden sm:inline">Search SKU, barcode, patient, case ID...</span>
            <span className="sm:hidden">Search...</span>
          </span>
          <kbd className="hidden sm:inline-flex items-center gap-0.5 rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] font-medium">
            ⌘K
          </kbd>
        </button>
      </IconHelp>

      <div className="flex-1" />

      <DropdownMenu>
        <IconHelp helpKey="new">
          <DropdownMenuTrigger asChild>
            <Button size="sm" className="gap-1.5 px-2.5 sm:px-3" aria-label="Create a new record">
              <Plus className="h-4 w-4" aria-hidden="true" />
              <span className="hidden sm:inline">New</span>
              <ChevronDown className="hidden h-3.5 w-3.5 opacity-70 sm:inline" aria-hidden="true" />
            </Button>
          </DropdownMenuTrigger>
        </IconHelp>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel>Quick create</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => navigate('/products?new=1')}>Product</DropdownMenuItem>
          <DropdownMenuItem onSelect={() => navigate('/purchase-orders?new=1')}>Purchase Order</DropdownMenuItem>
          <DropdownMenuItem onSelect={() => navigate('/patients?new=1')}>Patient</DropdownMenuItem>
          <DropdownMenuItem onSelect={() => navigate('/cases?new=1')}>Case</DropdownMenuItem>
          <DropdownMenuItem onSelect={() => navigate('/loans?new=1')}>Loan</DropdownMenuItem>
          <DropdownMenuItem onSelect={() => navigate('/sales?new=1')}>Sale</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <DropdownMenu>
        <IconHelp helpKey="notifications">
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="icon" className="relative" aria-label={`Notifications${alertCount > 0 ? `, ${alertCount} requiring attention` : ''}`}>
              <Bell className="h-4 w-4" aria-hidden="true" />
              {alertCount > 0 && (
                <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-medium text-danger-foreground">
                  {alertCount}
                </span>
              )}
            </Button>
          </DropdownMenuTrigger>
        </IconHelp>
        <DropdownMenuContent align="end" className="w-72">
          <DropdownMenuLabel>Needs your attention</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {alertCount === 0 && <p className="px-2 py-3 text-sm text-muted-foreground">You're all caught up — nothing needs attention right now.</p>}
          {lowStock.length > 0 && (
            <DropdownMenuItem onSelect={() => navigate('/inventory')} className="items-start gap-2">
              <AlertTriangle className="mt-0.5 h-4 w-4 text-warning-600 shrink-0" aria-hidden="true" />
              <span>
                <span className="font-medium">{lowStock.length} product{lowStock.length !== 1 ? 's' : ''} low on stock</span>
                <br />
                <span className="text-xs text-muted-foreground">Reorder before they run out</span>
              </span>
            </DropdownMenuItem>
          )}
          {pendingPOs.length > 0 && (
            <DropdownMenuItem onSelect={() => navigate('/purchase-orders')} className="items-start gap-2">
              <ClipboardList className="mt-0.5 h-4 w-4 text-primary shrink-0" aria-hidden="true" />
              <span>
                <span className="font-medium">{pendingPOs.length} purchase order{pendingPOs.length !== 1 ? 's' : ''} awaiting receipt</span>
                <br />
                <span className="text-xs text-muted-foreground">Track them until they arrive</span>
              </span>
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <DropdownMenu>
        <IconHelp helpKey="theme">
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="icon" aria-label="Change theme">
              <ThemeIcon className="h-4 w-4" aria-hidden="true" />
            </Button>
          </DropdownMenuTrigger>
        </IconHelp>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => setTheme('light')}>
            <Sun className="mr-2 h-4 w-4" /> Light
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setTheme('dark')}>
            <Moon className="mr-2 h-4 w-4" /> Dark
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setTheme('system')}>
            <Laptop className="mr-2 h-4 w-4" /> System
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <DropdownMenu>
        <IconHelp helpKey="profile">
          <DropdownMenuTrigger asChild>
            <button
              className="flex items-center gap-2 rounded-lg pl-1 pr-2 py-1 hover:bg-surface-hover transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label={`Account menu for ${currentUser.name}`}
            >
              <Avatar className="h-7 w-7">
                <AvatarFallback style={{ backgroundColor: currentUser.avatarColor, color: 'white' }}>
                  {initials(currentUser.name)}
                </AvatarFallback>
              </Avatar>
            </button>
          </DropdownMenuTrigger>
        </IconHelp>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel className="font-normal">
            <p className="text-sm font-medium text-foreground">{currentUser.name}</p>
            <p className="text-xs text-muted-foreground">{currentUser.email}</p>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => navigate('/settings')}>Clinic Settings</DropdownMenuItem>
          <DropdownMenuItem onSelect={() => navigate('/users')}>Manage Users</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => setAboutOpen(true)}>About ImplaTrax</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={aboutOpen} onOpenChange={setAboutOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader className="items-center text-center">
            <Logo className="h-8 mb-2" />
            <DialogTitle className="sr-only">About ImplaTrax</DialogTitle>
            <DialogDescription className="text-sm font-medium uppercase tracking-wide text-primary-700 dark:text-primary-300">
              {BRAND.tagline}
            </DialogDescription>
          </DialogHeader>
          <p className="text-center text-sm text-muted-foreground">
            ImplaTrax is inventory management built for dental implant practices — components, cases, loans, and
            purchasing, all in one place.
          </p>
        </DialogContent>
      </Dialog>
    </header>
  )
}
