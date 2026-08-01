// ============================================================================
// ImplaTrax — Domain Types
// ============================================================================

export type ID = string

// ---------------------------------------------------------------------------
// Products
// ---------------------------------------------------------------------------

export type Manufacturer =
  | 'Straumann'
  | 'Nobel Biocare'
  | 'Osstem'
  | 'NeoBiotech'
  | 'Dentium'
  | 'MIS'

/** Single source of truth for the Manufacturer picklist — a fixed, real-world catalog of implant brands, not per-clinic data, so it stays a static list rather than a persisted table (PROJECT.md §3, Master Data Audit). */
export const MANUFACTURERS: Manufacturer[] = ['Straumann', 'Nobel Biocare', 'Osstem', 'NeoBiotech', 'Dentium', 'MIS']

export type ProductCategory =
  | 'Implant Fixture'
  | 'Healing Abutment'
  | 'Final Abutment'
  | 'Cover Screw'
  | 'Impression Coping'
  | 'Analog'
  | 'Surgical Kit'
  | 'Bone Graft Material'
  | 'Membrane'
  | 'Prosthetic Screw'

/** Single source of truth for the Category picklist — same rationale as MANUFACTURERS above. */
export const PRODUCT_CATEGORIES: ProductCategory[] = [
  'Implant Fixture', 'Healing Abutment', 'Final Abutment', 'Cover Screw', 'Impression Coping',
  'Analog', 'Surgical Kit', 'Bone Graft Material', 'Membrane', 'Prosthetic Screw',
]

export interface Product {
  id: ID
  sku: string
  name: string
  manufacturer: Manufacturer
  category: ProductCategory
  system: string // e.g. "BLX", "TiBase", "TS III"
  diameterMm?: number
  lengthMm?: number
  platform?: string // e.g. "NC", "RC", "WP"
  barcode: string // auto-generated, CODE128
  qrPayload: string // auto-generated, encodes sku+id
  unitCost: number
  unitPrice: number
  priceVisible: boolean
  quantityOnHand: number
  quantityReserved: number
  lowStockThreshold: number
  batchTracked: boolean
  vendorId: ID
  imageColor: string // deterministic accent color for placeholder thumbnail
  description: string
  createdAt: string
  updatedAt: string
  status: 'active' | 'discontinued'
}

export interface ProductBatch {
  id: ID
  productId: ID
  lotNumber: string
  expiryDate?: string
  quantity: number
  receivedAt: string
  /** Purchase Order number this batch was received against — the origin point of its traceability story. */
  reference?: string
}

// ---------------------------------------------------------------------------
// Inventory
// ---------------------------------------------------------------------------

export type MovementType = 'inbound' | 'outbound' | 'adjustment' | 'loan-out' | 'loan-return' | 'sale' | 'lost'

/**
 * Every field below is captured directly, at write time, by the action that
 * creates the movement (P1-N, locked 2026-07-29) — never reconstructed later
 * via a join through PO/Loan/Sale/Case. `quantityBefore`/`quantityAfter` make
 * every record a self-contained snapshot of the product's stock at that
 * moment; `vendorId`/`labId`/`patientId`/`doctor`/`caseId` make every record
 * directly filterable without depending on `reference` string-matching a
 * business-document number. Not every field applies to every `type` — see
 * PROJECT.md §3 for the exact linkage rules per movement type.
 */
export interface InventoryMovement {
  id: ID
  productId: ID
  type: MovementType
  quantity: number // signed: positive = stock increase, negative = decrease
  quantityBefore: number
  quantityAfter: number
  reason: string
  reference?: string // PO number, Loan number, Sale number — the human-readable business document
  performedBy: ID // user id
  createdAt: string
  note?: string
  /** Lot/batch number this movement affected, for batch-tracked products. */
  batchLot?: string
  vendorId?: ID
  labId?: ID
  patientId?: ID
  /** Display string, e.g. "Dr. Alan Whitfield" — matches Case.doctor's convention, not a Doctor.id FK (PROJECT.md §3). */
  doctor?: string
  caseId?: ID
}

// ---------------------------------------------------------------------------
// Vendors & Purchase Orders
// ---------------------------------------------------------------------------

export interface Vendor {
  id: ID
  name: string
  contactName: string
  email: string
  phone: string
  address: string
  country: string
  manufacturers: Manufacturer[]
  onTimeRate: number // 0-1
  totalOrders: number
  createdAt: string
}

export type POStatus = 'draft' | 'submitted' | 'confirmed' | 'partially-received' | 'received' | 'cancelled'

export interface PurchaseOrderLine {
  id: ID
  productId: ID
  quantityOrdered: number
  quantityReceived: number
  unitCost: number
}

/** One entry in a Purchase Order's audit trail — every status change is recorded, append-only. */
export interface PurchaseOrderEvent {
  id: ID
  poId: ID
  label: string
  description: string
  date: string
  actor: string
}

export interface PurchaseOrder {
  id: ID
  poNumber: string // timestamp-based, format YYYYMMDDHHmm — see src/lib/idGenerator.ts
  vendorId: ID
  status: POStatus
  eta: string
  createdAt: string
  submittedAt?: string
  confirmedAt?: string
  receivedAt?: string
  lines: PurchaseOrderLine[]
  notes?: string
  /** Append-only audit trail — every status transition adds an entry here, never edited or removed. */
  history: PurchaseOrderEvent[]
  /** Optional reference photo (e.g. a photographed paper PO or packing slip), stored as a data URL. */
  photoDataUrl?: string
}

// ---------------------------------------------------------------------------
// Doctors
// ---------------------------------------------------------------------------

/**
 * A real, persisted lookup table (not a per-product/per-patient string) so the
 * same doctor is reused across Patients, Cases, and any future workflow
 * instead of re-typing a name each time — created inline from the doctor
 * autocomplete field, never from a dedicated management page (PROJECT.md §3).
 * `name` excludes the "Dr." prefix; every UI display composes "Dr. " + name.
 */
export interface Doctor {
  id: ID
  name: string
  createdAt: string
  active: boolean
}

// ---------------------------------------------------------------------------
// Patients & Cases
// ---------------------------------------------------------------------------

export interface Patient {
  id: ID
  patientCode: string // e.g. PT-00123
  firstName: string
  lastName: string
  dob: string
  sex: 'male' | 'female'
  phone: string
  email: string
  primaryDoctor: string
  createdAt: string
  notes?: string
}

export type CaseStatus = 'planning' | 'surgery-scheduled' | 'in-progress' | 'restoration' | 'completed' | 'cancelled'

export interface CaseTimelineEvent {
  id: ID
  caseId: ID
  label: string
  description: string
  date: string
  actor: string
}

export interface CaseImplantUsage {
  productId: ID
  tooth: string // FDI tooth number e.g. "36"
  quantity: number
  batchLot?: string
}

export interface Case {
  id: ID
  caseId: string // human readable: IDC-2026-00001
  patientId: ID
  doctor: string
  labId?: ID
  status: CaseStatus
  procedure: string
  createdAt: string
  scheduledDate?: string
  completedDate?: string
  implants: CaseImplantUsage[]
  notes?: string
  /** Append-only audit trail — every status transition and implant addition adds an entry here, never edited or removed. */
  history: CaseTimelineEvent[]
}

// ---------------------------------------------------------------------------
// Labs
// ---------------------------------------------------------------------------

export interface Lab {
  id: ID
  name: string
  contactName: string
  email: string
  phone: string
  address: string
  specialties: string[]
  rating: number // 0-5
  turnaroundDays: number
  createdAt: string
}

// ---------------------------------------------------------------------------
// Sales
// ---------------------------------------------------------------------------

export interface SaleLine {
  productId: ID
  quantity: number
  unitPrice: number
  batchLot?: string
}

export interface Sale {
  id: ID
  saleNumber: string // SL-2026-00001
  patientId?: ID
  caseId?: ID
  lines: SaleLine[]
  total: number
  soldBy: ID
  createdAt: string
}

// ---------------------------------------------------------------------------
// Loans & Loan Returns (Labs only)
// ---------------------------------------------------------------------------

export type LoanStatus = 'open' | 'partially-returned' | 'closed'

export interface LoanLine {
  id: ID
  productId: ID
  quantityLoaned: number
  quantityReturned: number
  quantityLost: number
  lostReason?: string
  batchLot?: string
}

/** One entry in a Loan's audit trail — every issue/return event is recorded, append-only. */
export interface LoanEvent {
  id: ID
  loanId: ID
  label: string
  description: string
  date: string
  actor: string
}

export interface Loan {
  id: ID
  loanNumber: string // LN-2026-00001
  labId: ID
  status: LoanStatus
  lines: LoanLine[]
  issuedBy: ID
  issuedAt: string
  dueDate?: string
  closedAt?: string
  notes?: string
  /** Append-only audit trail — every issue/return event adds an entry here, never edited or removed. */
  history: LoanEvent[]
}

export interface LoanReturnRecord {
  id: ID
  loanId: ID
  productId: ID
  quantityReturned: number
  quantityLost: number
  lostReason?: string
  receivedBy: ID
  createdAt: string
}

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------

export type UserRole = 'admin' | 'clinician' | 'inventory-manager' | 'front-desk'

export interface AppUser {
  id: ID
  name: string
  email: string
  role: UserRole
  avatarColor: string
  active: boolean
  createdAt: string
}

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

export interface ClinicSettings {
  clinicName: string
  address: string
  phone: string
  email: string
  country: string
  /** Data URI of an uploaded logo, resized client-side — empty string means no logo set. */
  logoDataUrl: string
  currency: string
  priceVisibilityDefault: boolean
  barcodeFormat: 'CODE128' | 'CODE39' | 'EAN13'
  lowStockGlobalDefault: number
  theme: 'light' | 'dark' | 'system'
  /** Application-wide Batch/Lot Tracking switch (PROJECT.md §3, locked 2026-07-28) — not a per-product setting. */
  batchLotTrackingEnabled: boolean
}
