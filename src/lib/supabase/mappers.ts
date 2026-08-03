/**
 * Bidirectional converters between the app's camelCase domain types
 * (src/types/index.ts) and the DB's snake_case rows (database.types.ts).
 * Every enum here differs only in punctuation (spaces/hyphens in the app
 * vs. underscores in Postgres) except ProductCategory, which differs only
 * in casing+spacing — both directions are purely mechanical, so this file
 * is a set of small, generic transforms plus one struct-shaped mapper per
 * entity, rather than a hand-maintained value-by-value lookup table.
 */
import type {
  Product, ProductBatch, InventoryMovement, Vendor, PurchaseOrder, PurchaseOrderLine, PurchaseOrderEvent,
  Doctor, Patient, Case, CaseTimelineEvent, CaseImplantUsage, Lab, Sale, SaleLine, Loan, LoanLine, LoanEvent,
  ClinicSettings, ProductCategory, POStatus, MovementType, CaseStatus, LoanStatus, Manufacturer,
} from '@/types'
import type { Database } from './database.types'

type Row<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Row']

const hyphenToUnderscore = (s: string) => s.replace(/-/g, '_')
const underscoreToHyphen = (s: string) => s.replace(/_/g, '-')

/** 'Implant Fixture' <-> 'implant_fixture' — spacing/casing only, no irregular values. */
export function categoryToDb(c: ProductCategory): Database['public']['Enums']['product_category'] {
  return c.toLowerCase().replace(/ /g, '_') as Database['public']['Enums']['product_category']
}
export function categoryFromDb(c: string): ProductCategory {
  return c.split('_').map((w) => w[0].toUpperCase() + w.slice(1)).join(' ') as ProductCategory
}

export const accountRoleToDb = (s: string) => hyphenToUnderscore(s) as Database['public']['Enums']['account_role']
export const accountRoleFromDb = (s: string) => underscoreToHyphen(s)
export const poStatusToDb = (s: POStatus) => hyphenToUnderscore(s) as Database['public']['Enums']['po_status']
export const poStatusFromDb = (s: string) => underscoreToHyphen(s) as POStatus
export const movementTypeToDb = (t: MovementType) => hyphenToUnderscore(t) as Database['public']['Enums']['movement_type']
export const movementTypeFromDb = (t: string) => underscoreToHyphen(t) as MovementType
export const caseStatusToDb = (s: CaseStatus) => hyphenToUnderscore(s) as Database['public']['Enums']['case_status']
export const caseStatusFromDb = (s: string) => underscoreToHyphen(s) as CaseStatus
export const loanStatusToDb = (s: LoanStatus) => hyphenToUnderscore(s) as Database['public']['Enums']['loan_status']
export const loanStatusFromDb = (s: string) => underscoreToHyphen(s) as LoanStatus

// ---------------------------------------------------------------------------
// Products (manufacturer name <-> manufacturer_id needs a lookup map, built
// once per session from the global `manufacturers` reference table and
// threaded through every call here — see manufacturerCache.ts).
// ---------------------------------------------------------------------------

export function productFromDb(row: Row<'products'>, manufacturerName: Manufacturer): Product {
  return {
    id: row.id,
    sku: row.sku,
    name: row.name,
    manufacturer: manufacturerName,
    category: categoryFromDb(row.category),
    system: row.system,
    diameterMm: row.diameter_mm ?? undefined,
    lengthMm: row.length_mm ?? undefined,
    platform: row.platform ?? undefined,
    barcode: row.barcode,
    qrPayload: row.qr_payload,
    unitCost: row.unit_cost,
    unitPrice: row.unit_price,
    priceVisible: row.price_visible,
    quantityOnHand: row.quantity_on_hand,
    quantityReserved: row.quantity_reserved,
    lowStockThreshold: row.low_stock_threshold,
    batchTracked: row.batch_tracked,
    vendorId: row.vendor_id,
    imageColor: row.image_color,
    description: row.description,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    status: row.status,
  }
}

export function productBatchFromDb(row: Row<'product_batches'>): ProductBatch {
  return {
    id: row.id,
    productId: row.product_id,
    lotNumber: row.lot_number,
    expiryDate: row.expiry_date ?? undefined,
    quantity: row.quantity,
    receivedAt: row.received_at,
    reference: row.reference ?? undefined,
  }
}

export function movementFromDb(row: Row<'inventory_movements'>): InventoryMovement {
  return {
    id: row.id,
    productId: row.product_id,
    type: movementTypeFromDb(row.type),
    quantity: row.quantity,
    quantityBefore: row.quantity_before,
    quantityAfter: row.quantity_after,
    reason: row.reason,
    reference: row.reference ?? undefined,
    performedBy: row.performed_by ?? '',
    createdAt: row.created_at,
    note: row.note ?? undefined,
    batchLot: row.batch_lot ?? undefined,
    vendorId: row.vendor_id ?? undefined,
    labId: row.lab_id ?? undefined,
    patientId: row.patient_id ?? undefined,
    doctor: row.doctor ?? undefined,
    caseId: row.case_id ?? undefined,
    photoUrls: row.photo_urls?.length ? row.photo_urls : undefined,
  }
}

export function vendorFromDb(row: Row<'vendors'>, manufacturers: Manufacturer[]): Vendor {
  return {
    id: row.id,
    name: row.name,
    contactName: row.contact_name,
    email: row.email,
    phone: row.phone,
    address: row.address,
    country: row.country,
    manufacturers,
    onTimeRate: row.on_time_rate,
    totalOrders: row.total_orders,
    createdAt: row.created_at,
  }
}

export function poLineFromDb(row: Row<'purchase_order_lines'>): PurchaseOrderLine {
  return { id: row.id, productId: row.product_id, quantityOrdered: row.quantity_ordered, quantityReceived: row.quantity_received, unitCost: row.unit_cost }
}

export function poEventFromDb(row: Row<'purchase_order_events'>): PurchaseOrderEvent {
  return { id: row.id, poId: row.po_id, label: row.label, description: row.description, date: row.event_date, actor: row.actor }
}

export function purchaseOrderFromDb(row: Row<'purchase_orders'>, lines: PurchaseOrderLine[], history: PurchaseOrderEvent[]): PurchaseOrder {
  return {
    id: row.id,
    poNumber: row.po_number,
    vendorId: row.vendor_id,
    status: poStatusFromDb(row.status),
    eta: row.eta ?? '',
    createdAt: row.created_at,
    submittedAt: row.submitted_at ?? undefined,
    confirmedAt: row.confirmed_at ?? undefined,
    receivedAt: row.received_at ?? undefined,
    lines,
    notes: row.notes ?? undefined,
    history,
    photoDataUrl: row.photo_url ?? undefined,
    photoUrls: row.photo_urls?.length ? row.photo_urls : undefined,
  }
}

export function doctorFromDb(row: Row<'doctors'>): Doctor {
  return { id: row.id, name: row.name, createdAt: row.created_at, active: row.active }
}

export function patientFromDb(row: Row<'patients'>): Patient {
  return {
    id: row.id,
    patientCode: row.patient_code,
    firstName: row.first_name,
    lastName: row.last_name,
    dob: row.dob,
    sex: row.sex,
    phone: row.phone,
    email: row.email,
    primaryDoctor: row.primary_doctor,
    createdAt: row.created_at,
    notes: row.notes ?? undefined,
  }
}

export function caseImplantUsageFromDb(row: Row<'case_implant_usages'>): CaseImplantUsage {
  return { productId: row.product_id, tooth: row.tooth, quantity: row.quantity, batchLot: row.batch_lot ?? undefined }
}

export function caseEventFromDb(row: Row<'case_events'>): CaseTimelineEvent {
  return { id: row.id, caseId: row.case_id, label: row.label, description: row.description, date: row.event_date, actor: row.actor }
}

export function caseFromDb(row: Row<'cases'>, implants: CaseImplantUsage[], history: CaseTimelineEvent[]): Case {
  return {
    id: row.id,
    caseId: row.case_number,
    patientId: row.patient_id,
    doctor: row.doctor,
    labId: row.lab_id ?? undefined,
    status: caseStatusFromDb(row.status),
    procedure: row.procedure_description,
    createdAt: row.created_at,
    scheduledDate: row.scheduled_date ?? undefined,
    completedDate: row.completed_date ?? undefined,
    implants,
    notes: row.notes ?? undefined,
    history,
  }
}

export function labFromDb(row: Row<'labs'>): Lab {
  return {
    id: row.id,
    name: row.name,
    contactName: row.contact_name,
    email: row.email,
    phone: row.phone,
    address: row.address,
    specialties: row.specialties,
    rating: row.rating,
    turnaroundDays: row.turnaround_days,
    createdAt: row.created_at,
  }
}

export function saleLineFromDb(row: Row<'sale_lines'>): SaleLine {
  return { productId: row.product_id, quantity: row.quantity, unitPrice: row.unit_price, batchLot: row.batch_lot ?? undefined }
}

export function saleFromDb(row: Row<'sales'>, lines: SaleLine[]): Sale {
  return {
    id: row.id,
    saleNumber: row.sale_number,
    patientId: row.patient_id,
    caseId: row.case_id ?? undefined,
    lines,
    total: row.total,
    soldBy: row.sold_by ?? '',
    createdAt: row.created_at,
    voidedAt: row.voided_at ?? undefined,
    voidReason: row.void_reason ?? undefined,
    photoUrls: row.photo_urls?.length ? row.photo_urls : undefined,
  }
}

export function loanLineFromDb(row: Row<'loan_lines'>): LoanLine {
  return {
    id: row.id,
    productId: row.product_id,
    quantityLoaned: row.quantity_loaned,
    quantityReturned: row.quantity_returned,
    quantityLost: row.quantity_lost,
    lostReason: row.lost_reason ?? undefined,
    batchLot: row.batch_lot ?? undefined,
  }
}

export function loanEventFromDb(row: Row<'loan_events'>): LoanEvent {
  return { id: row.id, loanId: row.loan_id, label: row.label, description: row.description, date: row.event_date, actor: row.actor }
}

export function loanFromDb(row: Row<'loans'>, lines: LoanLine[], history: LoanEvent[]): Loan {
  return {
    id: row.id,
    loanNumber: row.loan_number,
    labId: row.lab_id,
    status: loanStatusFromDb(row.status),
    lines,
    issuedBy: '',
    issuedAt: row.created_at,
    dueDate: row.due_date ?? undefined,
    closedAt: row.status === 'closed' ? row.updated_at : undefined,
    notes: row.notes ?? undefined,
    history,
    photoUrls: row.photo_urls?.length ? row.photo_urls : undefined,
  }
}

export function clinicSettingsFromDb(row: Row<'clinic_settings'>): ClinicSettings {
  return {
    clinicName: row.clinic_name,
    address: row.address,
    phone: row.phone,
    email: row.email,
    country: row.country,
    logoDataUrl: row.logo_url ?? '',
    currency: row.currency,
    priceVisibilityDefault: row.price_visibility_default,
    barcodeFormat: row.barcode_format,
    lowStockGlobalDefault: row.low_stock_global_default,
    theme: row.theme,
    batchLotTrackingEnabled: row.batch_lot_tracking_enabled,
  }
}

export function clinicSettingsToDb(patch: Partial<ClinicSettings>): Partial<Row<'clinic_settings'>> {
  const out: Partial<Row<'clinic_settings'>> = {}
  if (patch.clinicName !== undefined) out.clinic_name = patch.clinicName
  if (patch.address !== undefined) out.address = patch.address
  if (patch.phone !== undefined) out.phone = patch.phone
  if (patch.email !== undefined) out.email = patch.email
  if (patch.country !== undefined) out.country = patch.country
  if (patch.logoDataUrl !== undefined) out.logo_url = patch.logoDataUrl || null
  if (patch.currency !== undefined) out.currency = patch.currency
  if (patch.priceVisibilityDefault !== undefined) out.price_visibility_default = patch.priceVisibilityDefault
  if (patch.barcodeFormat !== undefined) out.barcode_format = patch.barcodeFormat
  if (patch.lowStockGlobalDefault !== undefined) out.low_stock_global_default = patch.lowStockGlobalDefault
  if (patch.theme !== undefined) out.theme = patch.theme
  if (patch.batchLotTrackingEnabled !== undefined) out.batch_lot_tracking_enabled = patch.batchLotTrackingEnabled
  return out
}
