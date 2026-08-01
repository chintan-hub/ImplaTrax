import {
  LayoutDashboard,
  Package,
  Boxes,
  ClipboardList,
  Truck,
  Users,
  FolderKanban,
  FlaskConical,
  Receipt,
  HandCoins,
  Undo2,
  Layers,
  BarChart3,
  UserCog,
  Settings,
  type LucideIcon,
} from 'lucide-react'
import type { IconHelpKey } from '@/content/helpText'

export interface NavItem {
  label: string
  to: string
  icon: LucideIcon
  group: 'Overview' | 'Inventory' | 'Care' | 'Operations' | 'System'
  helpKey?: IconHelpKey
  /** Only shown when ClinicSettings.batchLotTrackingEnabled is on (PROJECT.md §3) — hidden entirely when off. */
  requiresBatchLotTracking?: boolean
  /** Spotlight target id for the first-time product tour (see src/features/tour) — only set on the 7 stops the tour covers. */
  tourId?: string
}

export const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', to: '/', icon: LayoutDashboard, group: 'Overview', helpKey: 'dashboard', tourId: 'nav-dashboard' },
  { label: 'Products', to: '/products', icon: Package, group: 'Inventory', tourId: 'nav-products' },
  { label: 'Inventory', to: '/inventory', icon: Boxes, group: 'Inventory', tourId: 'nav-inventory' },
  { label: 'Purchase Orders', to: '/purchase-orders', icon: ClipboardList, group: 'Inventory' },
  { label: 'Batch / Lot Tracking', to: '/batches', icon: Layers, group: 'Inventory', requiresBatchLotTracking: true },
  { label: 'Vendors', to: '/vendors', icon: Truck, group: 'Inventory' },
  { label: 'Patients', to: '/patients', icon: Users, group: 'Care' },
  { label: 'Cases', to: '/cases', icon: FolderKanban, group: 'Care' },
  { label: 'Labs', to: '/labs', icon: FlaskConical, group: 'Care' },
  { label: 'Sales', to: '/sales', icon: Receipt, group: 'Operations', tourId: 'nav-sales' },
  { label: 'Loans', to: '/loans', icon: HandCoins, group: 'Operations', tourId: 'nav-loans' },
  { label: 'Loan Returns', to: '/loan-returns', icon: Undo2, group: 'Operations' },
  { label: 'Reports', to: '/reports', icon: BarChart3, group: 'Operations' },
  // Team access is managed on Settings' Workspace tab (real auth-backed
  // members, roles, invites) — not a separate page. See DataContext's old
  // `AppUser`/`addUser`, removed as a dead, disconnected duplicate that never
  // granted anyone real login access.
  { label: 'Team', to: '/settings?tab=workspace', icon: UserCog, group: 'System' },
  { label: 'Settings', to: '/settings', icon: Settings, group: 'System', helpKey: 'settings', tourId: 'nav-settings' },
]

export const NAV_GROUPS: NavItem['group'][] = ['Overview', 'Inventory', 'Care', 'Operations', 'System']
