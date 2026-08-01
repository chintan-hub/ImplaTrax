// ============================================================================
// ImplaTrax — Centralized Help & Copy Registry
//
// Every tooltip, term explanation, microcopy hint, empty-state message, and
// page introduction lives here. Nothing in the UI should hardcode this kind
// of explanatory text — components look it up by key so the whole app's
// voice can be edited in one place.
// ============================================================================

// ---------------------------------------------------------------------------
// Brand — used tastefully in a small number of places (dashboard welcome
// header, About dialog, auth screens). Never spammed throughout the UI.
// ---------------------------------------------------------------------------
export const BRAND = {
  tagline: 'Every Component. Every Movement. Every Time.',
} as const

export interface HelpEntry {
  title: string
  description: string
  shortcut?: string
}

// ---------------------------------------------------------------------------
// Terminology — inventory & dental terms that explain themselves on hover/tap
// ---------------------------------------------------------------------------
export const TERMS = {
  sku: {
    title: 'SKU',
    description: 'Unique code used to identify this component.',
  },
  barcode: {
    title: 'Barcode',
    description: 'Scan instead of typing to instantly identify a component.',
  },
  qrCode: {
    title: 'QR Code',
    description: 'Alternative scannable code that opens the component details.',
  },
  batchNumber: {
    title: 'Batch Number',
    description: "Manufacturer's production batch used for traceability.",
  },
  lowStock: {
    title: 'Low Stock',
    description: 'Quantity has reached its reorder level.',
  },
  reservedStock: {
    title: 'Reserved Stock',
    description: 'Components already allocated to a patient case but not yet used.',
  },
  stockMovement: {
    title: 'Stock Movement',
    description: 'Any action that changes inventory such as purchase, sale, loan, return or adjustment.',
  },
  adjustment: {
    title: 'Adjustment',
    description: 'Manual correction made when physical stock does not match the system.',
  },
  patient: {
    title: 'Patient',
    description: 'Person receiving implant treatment.',
  },
  case: {
    title: 'Case',
    description: 'One implant treatment linked to a patient.',
  },
  caseId: {
    title: 'Case ID',
    description: 'Automatically generated unique identifier for this treatment.',
  },
  vendor: {
    title: 'Vendor',
    description: 'Company from whom components are purchased.',
  },
  lab: {
    title: 'Lab',
    description: 'Dental laboratory working on the implant case.',
  },
  purchaseOrder: {
    title: 'Purchase Order',
    description: 'Record of components ordered from a vendor before they arrive.',
  },
  loan: {
    title: 'Loan',
    description: 'Component temporarily sent to a dental laboratory and expected to be returned.',
  },
  loanReturn: {
    title: 'Return',
    description: 'Records that a loaned component has been received back into inventory.',
  },
  batchLot: {
    title: 'Batch / Lot',
    description: 'One specific delivery of a component, identified by the number printed on its packaging — used to trace exactly which units came from where.',
  },
  remainingQuantity: {
    title: 'Remaining',
    description: 'How many units of this lot are still in the business — received minus everything sold, loaned out, or lost. Units used in a case are shown separately (see below).',
  },
} as const satisfies Record<string, HelpEntry>

export type TermKey = keyof typeof TERMS

// ---------------------------------------------------------------------------
// Icon help — anything not immediately obvious gets a tooltip
// ---------------------------------------------------------------------------
export const ICON_HELP = {
  search: {
    title: 'Search',
    description: 'Search components, patients, cases and more.',
    shortcut: 'Ctrl + K',
  },
  new: {
    title: 'New',
    description: 'Create a new record.',
  },
  edit: {
    title: 'Edit',
    description: 'Modify this record.',
  },
  delete: {
    title: 'Delete',
    description: 'Permanently remove this record. Super Admin only.',
  },
  dashboard: {
    title: 'Dashboard',
    description: 'Overview of inventory health and recent activity.',
  },
  notifications: {
    title: 'Notifications',
    description: 'Important alerts requiring your attention.',
  },
  settings: {
    title: 'Settings',
    description: 'Configure ImplaTrax preferences.',
  },
  profile: {
    title: 'Profile',
    description: 'View your account information.',
  },
  theme: {
    title: 'Theme',
    description: 'Switch between light, dark, or system appearance.',
  },
  quickAdd: {
    title: 'Quick Add',
    description: 'Create a new product without leaving this page.',
  },
  cardView: {
    title: 'Card View',
    description: 'Browse products as visual cards.',
  },
  tableView: {
    title: 'Table View',
    description: 'Browse products in a sortable table.',
  },
  receive: {
    title: 'Receive',
    description: 'Record components that have arrived from the vendor.',
  },
  processReturn: {
    title: 'Process Return',
    description: 'Record components a lab is sending back, in full or in part.',
  },
  copyWhatsApp: {
    title: 'Copy WhatsApp Message',
    description: 'Copies a formatted summary of this purchase order to your clipboard, ready to paste into a WhatsApp chat.',
  },
  printPO: {
    title: 'Print',
    description: 'Open a clean, print-ready version of this purchase order in your browser’s print dialog.',
  },
  generatePdfPO: {
    title: 'Generate PDF',
    description: 'Open a clean, print-ready version of this purchase order — choose "Save as PDF" in your browser’s print dialog.',
  },
  attachPhoto: {
    title: 'Attach Photo',
    description: 'Attach a reference photo to this purchase order, such as a photographed packing slip.',
  },
} as const satisfies Record<string, HelpEntry>

export type IconHelpKey = keyof typeof ICON_HELP

// ---------------------------------------------------------------------------
// Form microcopy — short guidance shown directly under a field
// ---------------------------------------------------------------------------
export const MICROCOPY = {
  minStock: 'When stock reaches this quantity, ImplaTrax will remind you to reorder.',
  purchasePrice: 'The amount paid to the vendor for one unit.',
  sellingPrice: 'The amount charged when this component is sold or used in a case.',
  caseId: 'Automatically generated unique identifier for this treatment.',
  reason: 'This note becomes part of the permanent inventory history.',
  lostReason: 'This note becomes part of the permanent inventory history and reduces stock.',
  batchNumber: 'Optional. Used for manufacturer traceability.',
  priceVisible: 'Controls whether staff without pricing access can see cost and price for this component.',
  batchTracked: 'Turn this on for components where lot-level traceability matters, like implant fixtures or graft material.',
  batchLotTracking: 'Turn this on to track lot/batch numbers across purchase orders, receiving, sales, loans, returns, and inventory history. When off, Batch/Lot Tracking is hidden everywhere in the app.',
  dueDate: 'When you expect this loan to be returned by the lab. Loans can stay open for months if needed.',
  eta: 'The date you expect this order to arrive from the vendor.',
  receivingLot: 'Required for batch-tracked components — the number printed on the box or packing slip. This is what lets you trace exactly where a component came from and everywhere it went.',
  loanLot: 'Required for batch-tracked components — the same lot automatically follows this item when it comes back from the lab.',
  documentFooter: 'This is a computer-generated document from ImplaTrax.',
} as const

export type MicrocopyKey = keyof typeof MICROCOPY

// ---------------------------------------------------------------------------
// Page introductions — every page briefly explains its own purpose
// ---------------------------------------------------------------------------
export const PAGE_INTROS = {
  dashboard: {
    title: 'Welcome back.',
    description: "Here's what's happening in your implant inventory today.",
  },
  products: {
    title: 'Products',
    description: 'Every implant component your clinic stocks, with barcodes and QR codes generated automatically.',
  },
  inventory: {
    title: 'Inventory',
    description: 'Keep track of every implant component currently in stock.',
  },
  purchaseOrders: {
    title: 'Purchase Orders',
    description: 'Track incoming inventory before it reaches your shelves.',
  },
  vendors: {
    title: 'Vendors',
    description: 'The companies you buy implant components from.',
  },
  patients: {
    title: 'Patients',
    description: 'Manage implant patients and their treatment history.',
  },
  cases: {
    title: 'Cases',
    description: 'Every implant treatment, from planning through to a completed restoration.',
  },
  labs: {
    title: 'Labs',
    description: 'The dental laboratories you work with, and what they currently have on loan.',
  },
  sales: {
    title: 'Sales',
    description: 'Components permanently used or sold, usually tied to a patient case.',
  },
  loans: {
    title: 'Loans',
    description: 'Components temporarily sent to labs, expected to come back.',
  },
  loanReturns: {
    title: 'Loan Returns',
    description: 'A record of everything labs have sent back, and anything lost along the way.',
  },
  batches: {
    title: 'Batch / Lot Tracking',
    description: 'Full traceability for every batch-tracked component — where each lot came from, where it went, and how much is left.',
  },
  reports: {
    title: 'Reports',
    description: 'See how your inventory, sales, loans, and purchasing are trending.',
  },
  users: {
    title: 'Users',
    description: 'Everyone with access to ImplaTrax, and what they can do.',
  },
  settings: {
    title: 'Settings',
    description: 'Configure your clinic details, pricing visibility, barcodes, and appearance.',
  },
} as const

export type PageKey = keyof typeof PAGE_INTROS

// ---------------------------------------------------------------------------
// Empty states — every empty screen explains what, why, and what to do next
// ---------------------------------------------------------------------------
export interface EmptyStateEntry {
  title: string
  description: string
  actionLabel?: string
}

export const EMPTY_STATES = {
  loans: {
    title: 'No Loans Yet',
    description: 'A loan tracks components temporarily sent to a dental laboratory until they’re returned or used. Issue your first loan to start tracking one.',
    actionLabel: 'Issue Loan',
  },
  loanReturns: {
    title: 'No Returns Yet',
    description: 'Once a lab sends components back on an open loan, the return will show up here automatically.',
  },
  products: {
    title: 'No Products Yet',
    description: 'Products are the implants, abutments, and components in your catalog. Add your first product to start tracking stock.',
    actionLabel: 'Add Product',
  },
  inventory: {
    title: 'No Stock Movements Yet',
    description: 'A stock movement is recorded every time a purchase, sale, loan, return, or manual adjustment changes your inventory. Receive your first stock or record an adjustment to see it here.',
    actionLabel: 'New Adjustment',
  },
  purchaseOrders: {
    title: 'No Purchase Orders Yet',
    description: 'A purchase order tracks components you ordered from a vendor before they arrive. Create your first purchase order to start restocking.',
    actionLabel: 'New Purchase Order',
  },
  vendors: {
    title: 'No Vendors Yet',
    description: 'Vendors are the companies you buy implant components from. Add your first vendor to start creating purchase orders.',
    actionLabel: 'Add Vendor',
  },
  patients: {
    title: 'No Patients Yet',
    description: 'Patients are the people receiving implant treatment at your clinic. Add your first patient to start tracking their cases.',
    actionLabel: 'Add Patient',
  },
  cases: {
    title: 'No Cases Yet',
    description: 'A case is one implant treatment linked to a patient, with its own timeline and Case ID. Create your first case to get started.',
    actionLabel: 'New Case',
  },
  labs: {
    title: 'No Labs Yet',
    description: 'Labs are the dental laboratories you send loaned components to. Add your first lab before issuing a loan.',
    actionLabel: 'Add Lab',
  },
  sales: {
    title: 'No Sales Yet',
    description: 'A sale means a component was permanently used or sold, usually as part of a patient case. Record your first sale to see it here.',
    actionLabel: 'Record Sale',
  },
  batches: {
    title: 'No Batch/Lot Data Yet',
    description: 'Lots appear here once a batch-tracked product is received with a lot number. Go to Purchase Orders and receive your first shipment to get started.',
  },
  users: {
    title: 'No Team Members Yet',
    description: 'Add the people on your team so everyone has their own login and the right level of access.',
    actionLabel: 'Add User',
  },
} as const satisfies Record<string, EmptyStateEntry>

export type EmptyStateKey = keyof typeof EMPTY_STATES
