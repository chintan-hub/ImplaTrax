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
}

export const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', to: '/', icon: LayoutDashboard, group: 'Overview', helpKey: 'dashboard' },
  { label: 'Products', to: '/products', icon: Package, group: 'Inventory' },
  { label: 'Inventory', to: '/inventory', icon: Boxes, group: 'Inventory' },
  { label: 'Purchase Orders', to: '/purchase-orders', icon: ClipboardList, group: 'Inventory' },
  { label: 'Batch / Lot Tracking', to: '/batches', icon: Layers, group: 'Inventory', requiresBatchLotTracking: true },
  { label: 'Vendors', to: '/vendors', icon: Truck, group: 'Inventory' },
  { label: 'Patients', to: '/patients', icon: Users, group: 'Care' },
  { label: 'Cases', to: '/cases', icon: FolderKanban, group: 'Care' },
  { label: 'Labs', to: '/labs', icon: FlaskConical, group: 'Care' },
  { label: 'Sales', to: '/sales', icon: Receipt, group: 'Operations' },
  { label: 'Loans', to: '/loans', icon: HandCoins, group: 'Operations' },
  { label: 'Loan Returns', to: '/loan-returns', icon: Undo2, group: 'Operations' },
  { label: 'Reports', to: '/reports', icon: BarChart3, group: 'Operations' },
  { label: 'Users', to: '/users', icon: UserCog, group: 'System' },
  { label: 'Settings', to: '/settings', icon: Settings, group: 'System', helpKey: 'settings' },
]

export const NAV_GROUPS: NavItem['group'][] = ['Overview', 'Inventory', 'Care', 'Operations', 'System']
