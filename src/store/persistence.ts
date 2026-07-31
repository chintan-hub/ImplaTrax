import type {
  Product,
  InventoryMovement,
  PurchaseOrder,
  Vendor,
  Patient,
  Case,
  Lab,
  Sale,
  Loan,
  AppUser,
  ClinicSettings,
  ProductBatch,
  Doctor,
} from '@/types'

const STORAGE_KEY = 'implatrax:data:v1'
// Pre-rebrand key — data may still live here from before the app was renamed from ImplantDesk.
const LEGACY_STORAGE_KEY = 'implantdesk:data:v1'

export interface PersistedSnapshot {
  products: Product[]
  movements: InventoryMovement[]
  purchaseOrders: PurchaseOrder[]
  vendors: Vendor[]
  patients: Patient[]
  cases: Case[]
  labs: Lab[]
  sales: Sale[]
  loans: Loan[]
  users: AppUser[]
  clinicSettings: ClinicSettings
  batches: ProductBatch[]
  doctors: Doctor[]
  internalIdCounter: number
}

/**
 * Every business-data slice in DataContext is persisted to localStorage as
 * one JSON snapshot and rehydrated on load — there is no backend, so without
 * this every product, patient, case, sale, loan, and purchase order created
 * during a session was lost on refresh. `internalIdCounter` travels with it
 * so a fresh session's generated IDs never collide with previously-persisted
 * ones (see src/lib/idGenerator.ts's getInternalIdCounter/restoreInternalIdCounter).
 */
export function loadPersistedSnapshot(): PersistedSnapshot | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY) ?? localStorage.getItem(LEGACY_STORAGE_KEY)
    if (!raw) return null
    return JSON.parse(raw) as PersistedSnapshot
  } catch {
    return null
  }
}

export function savePersistedSnapshot(snapshot: PersistedSnapshot) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot))
    localStorage.removeItem(LEGACY_STORAGE_KEY)
  } catch {
    // localStorage unavailable or full — persistence is best-effort, not fatal to the session.
  }
}
