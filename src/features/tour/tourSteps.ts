export interface TourStep {
  id: string
  /** CSS selector for the element this step highlights — must match a `data-tour` attribute on persistent app chrome (sidebar/topbar), so it stays on screen while the tour runs regardless of which page the user started it from. */
  selector: string
  title: string
  description: string
}

export const TOUR_STEPS: TourStep[] = [
  {
    id: 'dashboard',
    selector: '[data-tour="nav-dashboard"]',
    title: 'Dashboard',
    description: 'Your daily overview — inventory value, low-stock alerts, and recent activity, all in one place.',
  },
  {
    id: 'products',
    selector: '[data-tour="nav-products"]',
    title: 'Products',
    description: 'Browse and manage every implant, abutment, and component in your catalog.',
  },
  {
    id: 'inventory',
    selector: '[data-tour="nav-inventory"]',
    title: 'Inventory',
    description: 'Every stock movement — inbound, sold, loaned, or adjusted — is recorded here automatically.',
  },
  {
    id: 'sales',
    selector: '[data-tour="nav-sales"]',
    title: 'Sales',
    description: 'Record components sold or used in a patient case. Stock updates the instant you save.',
  },
  {
    id: 'loans',
    selector: '[data-tour="nav-loans"]',
    title: 'Loans',
    description: 'Track components loaned out to labs, and know exactly what is still outstanding.',
  },
  {
    id: 'search',
    selector: '[data-tour="global-search"]',
    title: 'Global Search',
    description: 'Press ⌘K anytime to jump straight to a product, patient, case, or barcode.',
  },
  {
    id: 'settings',
    selector: '[data-tour="nav-settings"]',
    title: 'Settings',
    description: 'Set up your clinic details, manage your team, and adjust security — whenever you need to.',
  },
]
