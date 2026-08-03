/**
 * All Supabase reads/writes for the app, grouped by domain. Every mutating
 * call here either invokes one of the transactional RPCs (migrations
 * 0011/0013) for multi-row/quantity-affecting writes, or a plain
 * `.insert()`/`.update()` for single-row CRUD RLS already gates correctly
 * on its own. Every function returns app-shaped types (via mappers.ts), so
 * nothing above this file ever sees a snake_case row or a raw
 * PostgrestError — `unwrap()` turns the latter into a thrown Error with the
 * same message shape BusinessRuleError already used locally.
 */
import { supabase } from './client'
import type {
  Product, ProductBatch, InventoryMovement, Vendor, PurchaseOrder, Doctor, Patient, Case,
  Lab, Sale, SaleLine, Loan, ClinicSettings, Manufacturer,
} from '@/types'
import type { Database } from './database.types'
import {
  categoryToDb, productFromDb, productBatchFromDb, movementFromDb, vendorFromDb,
  poLineFromDb, poEventFromDb, purchaseOrderFromDb, doctorFromDb, patientFromDb,
  caseImplantUsageFromDb, caseEventFromDb, caseFromDb, caseStatusToDb, labFromDb, saleLineFromDb, saleFromDb,
  loanLineFromDb, loanEventFromDb, loanFromDb, clinicSettingsFromDb, clinicSettingsToDb,
} from './mappers'

type UpdatePatch<T extends keyof Database['public']['Tables']> = Partial<Database['public']['Tables'][T]['Update']>
/**
 * Explicit type argument at every `.single()` call site below — TS's
 * inference over supabase-js's `PostgrestSingleResponse<T>` (a discriminated
 * union of the success/error branches) collapses `T` to `null` when left to
 * infer on its own, so `unwrap<Row<'x'>>(...)` is required, not optional.
 */
type Row<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Row']

function client() {
  if (!supabase) throw new Error('Supabase is not configured')
  return supabase
}

function unwrap<T>({ data, error }: { data: T | null; error: { message: string } | null }): T {
  if (error) throw new Error(error.message)
  return data as T
}

async function countRows(query: PromiseLike<{ count: number | null; error: { message: string } | null }>): Promise<number> {
  const { count, error } = await query
  if (error) throw new Error(error.message)
  return count ?? 0
}

function pad(n: number, width: number) {
  return String(n).padStart(width, '0')
}

// ---------------------------------------------------------------------------
// Manufacturers — global, immutable reference data (migration 0003). Fetched
// once per page load and cached in module scope; both directions (name <->
// id) are needed constantly by product/vendor mapping.
// ---------------------------------------------------------------------------
let manufacturerCache: { id: string; name: Manufacturer }[] | null = null

async function getManufacturers() {
  if (manufacturerCache) return manufacturerCache
  const rows = unwrap(await client().from('manufacturers').select('id, name').order('name'))
  manufacturerCache = rows as { id: string; name: Manufacturer }[]
  return manufacturerCache
}

async function manufacturerIdByName(name: Manufacturer): Promise<string> {
  const list = await getManufacturers()
  const found = list.find((m) => m.name === name)
  if (!found) throw new Error(`Unknown manufacturer: ${name}`)
  return found.id
}

// ---------------------------------------------------------------------------
// Products
// ---------------------------------------------------------------------------

export async function fetchProducts(workspaceId: string): Promise<Product[]> {
  const rows = unwrap(await client().from('products').select('*').eq('workspace_id', workspaceId).order('created_at', { ascending: false }))
  const manufacturers = await getManufacturers()
  const byId = new Map(manufacturers.map((m) => [m.id, m.name]))
  return rows.map((r) => productFromDb(r, byId.get(r.manufacturer_id) ?? 'Straumann'))
}

/**
 * id is generated client-side (rather than left to the column's
 * gen_random_uuid() default) so qr_payload — which encodes the product's
 * own id — can be computed in the same insert instead of needing a second
 * update after. sku/barcode are derived from a live per-workspace count,
 * mirroring src/lib/idGenerator.ts's sequence format.
 *
 * quantity_on_hand always starts at 0 here, even if the caller supplied a
 * starting count — DataContext.addProduct follows this insert with
 * adjustStockRpc() for any nonzero starting quantity, so the stock bump and
 * its inventory_movements row are written by the same RPC that every other
 * stock change goes through, instead of this insert silently creating stock
 * with no movement to account for it.
 */
async function buildProductRow(workspaceId: string, input: Omit<Product, 'id' | 'sku' | 'barcode' | 'qrPayload' | 'createdAt' | 'updatedAt'>, seq: number) {
  const id = crypto.randomUUID()
  return {
    id,
    workspace_id: workspaceId,
    sku: `${input.manufacturer.slice(0, 3).toUpperCase()}-${input.system.slice(0, 4).toUpperCase()}-${pad(seq, 3)}`,
    name: input.name,
    manufacturer_id: await manufacturerIdByName(input.manufacturer),
    category: categoryToDb(input.category),
    system: input.system,
    diameter_mm: input.diameterMm ?? null,
    length_mm: input.lengthMm ?? null,
    platform: input.platform ?? null,
    barcode: `890${pad(2000000 + seq, 9)}`,
    qr_payload: `IMPD:PRD:${id}`,
    unit_cost: input.unitCost,
    unit_price: input.unitPrice,
    price_visible: input.priceVisible,
    quantity_on_hand: 0,
    quantity_reserved: input.quantityReserved,
    low_stock_threshold: input.lowStockThreshold,
    batch_tracked: input.batchTracked,
    vendor_id: input.vendorId,
    image_color: input.imageColor,
    description: input.description,
    status: input.status,
  }
}

export async function insertProduct(workspaceId: string, input: Omit<Product, 'id' | 'sku' | 'barcode' | 'qrPayload' | 'createdAt' | 'updatedAt'>): Promise<Product> {
  const count = await countRows(client().from('products').select('id', { count: 'exact', head: true }).eq('workspace_id', workspaceId))
  const row = unwrap<Row<'products'>>(await client().from('products').insert(await buildProductRow(workspaceId, input, count + 1)).select('*').single())
  return productFromDb(row, input.manufacturer)
}

export async function bulkInsertProducts(
  workspaceId: string,
  inputs: Omit<Product, 'id' | 'sku' | 'barcode' | 'qrPayload' | 'createdAt' | 'updatedAt'>[],
): Promise<Product[]> {
  const count = await countRows(client().from('products').select('id', { count: 'exact', head: true }).eq('workspace_id', workspaceId))
  const startSeq = count + 1
  const draftRows = await Promise.all(inputs.map((input, i) => buildProductRow(workspaceId, input, startSeq + i)))
  const rows = unwrap(await client().from('products').insert(draftRows).select('*'))
  const manufacturers = await getManufacturers()
  const byId = new Map(manufacturers.map((m) => [m.id, m.name]))
  return rows.map((r) => productFromDb(r, byId.get(r.manufacturer_id) ?? 'Straumann'))
}

export async function updateProductRow(id: string, patch: Partial<Product>): Promise<void> {
  const dbPatch: UpdatePatch<'products'> = {}
  if (patch.name !== undefined) dbPatch.name = patch.name
  if (patch.manufacturer !== undefined) dbPatch.manufacturer_id = await manufacturerIdByName(patch.manufacturer)
  if (patch.category !== undefined) dbPatch.category = categoryToDb(patch.category)
  if (patch.system !== undefined) dbPatch.system = patch.system
  if (patch.diameterMm !== undefined) dbPatch.diameter_mm = patch.diameterMm
  if (patch.lengthMm !== undefined) dbPatch.length_mm = patch.lengthMm
  if (patch.platform !== undefined) dbPatch.platform = patch.platform
  if (patch.unitCost !== undefined) dbPatch.unit_cost = patch.unitCost
  if (patch.unitPrice !== undefined) dbPatch.unit_price = patch.unitPrice
  if (patch.priceVisible !== undefined) dbPatch.price_visible = patch.priceVisible
  if (patch.lowStockThreshold !== undefined) dbPatch.low_stock_threshold = patch.lowStockThreshold
  if (patch.batchTracked !== undefined) dbPatch.batch_tracked = patch.batchTracked
  if (patch.vendorId !== undefined) dbPatch.vendor_id = patch.vendorId
  if (patch.description !== undefined) dbPatch.description = patch.description
  if (patch.status !== undefined) dbPatch.status = patch.status
  unwrap(await client().from('products').update(dbPatch).eq('id', id))
}

export async function fetchProductBatches(workspaceId: string): Promise<ProductBatch[]> {
  const rows = unwrap(await client().from('product_batches').select('*').eq('workspace_id', workspaceId).order('received_at', { ascending: false }))
  return rows.map(productBatchFromDb)
}

// ---------------------------------------------------------------------------
// Inventory movements (read-only from the client — every insert happens
// server-side, inside an RPC, alongside the row it's an audit trail for)
// ---------------------------------------------------------------------------

export async function fetchMovements(workspaceId: string): Promise<InventoryMovement[]> {
  const rows = unwrap(await client().from('inventory_movements').select('*').eq('workspace_id', workspaceId).order('created_at', { ascending: false }))
  return rows.map(movementFromDb)
}

export async function adjustStockRpc(productId: string, delta: number, reason: string, note?: string): Promise<void> {
  unwrap(
    await client().rpc('adjust_stock', {
      p_product_id: productId,
      p_delta: delta,
      p_type: 'adjustment',
      p_reason: reason,
      p_note: note ?? null,
    }),
  )
}

// ---------------------------------------------------------------------------
// Vendors
// ---------------------------------------------------------------------------

export async function fetchVendors(workspaceId: string): Promise<Vendor[]> {
  const rows = unwrap(await client().from('vendors').select('*').eq('workspace_id', workspaceId).order('name'))
  const links = unwrap(
    await client().from('vendor_manufacturers').select('vendor_id, manufacturer_id').in('vendor_id', rows.map((r) => r.id).length ? rows.map((r) => r.id) : ['00000000-0000-0000-0000-000000000000']),
  )
  const manufacturers = await getManufacturers()
  const nameById = new Map(manufacturers.map((m) => [m.id, m.name]))
  const byVendor = new Map<string, Manufacturer[]>()
  links.forEach((l) => {
    const list = byVendor.get(l.vendor_id) ?? []
    const name = nameById.get(l.manufacturer_id)
    if (name) list.push(name)
    byVendor.set(l.vendor_id, list)
  })
  return rows.map((r) => vendorFromDb(r, byVendor.get(r.id) ?? []))
}

export async function insertVendor(workspaceId: string, input: Omit<Vendor, 'id' | 'createdAt' | 'totalOrders' | 'onTimeRate'>): Promise<Vendor> {
  const row = unwrap<Row<'vendors'>>(
    await client()
      .from('vendors')
      .insert({
        workspace_id: workspaceId,
        name: input.name,
        contact_name: input.contactName,
        email: input.email,
        phone: input.phone,
        address: input.address,
        country: input.country,
      })
      .select('*')
      .single(),
  )
  if (input.manufacturers.length > 0) {
    const ids = await Promise.all(input.manufacturers.map(manufacturerIdByName))
    unwrap(await client().from('vendor_manufacturers').insert(ids.map((manufacturer_id) => ({ vendor_id: row.id, manufacturer_id }))))
  }
  return vendorFromDb(row, input.manufacturers)
}

export async function updateVendorRow(id: string, patch: Partial<Vendor>): Promise<void> {
  const dbPatch: UpdatePatch<'vendors'> = {}
  if (patch.name !== undefined) dbPatch.name = patch.name
  if (patch.contactName !== undefined) dbPatch.contact_name = patch.contactName
  if (patch.email !== undefined) dbPatch.email = patch.email
  if (patch.phone !== undefined) dbPatch.phone = patch.phone
  if (patch.address !== undefined) dbPatch.address = patch.address
  if (patch.country !== undefined) dbPatch.country = patch.country
  if (Object.keys(dbPatch).length > 0) unwrap(await client().from('vendors').update(dbPatch).eq('id', id))
  if (patch.manufacturers !== undefined) {
    unwrap(await client().from('vendor_manufacturers').delete().eq('vendor_id', id))
    if (patch.manufacturers.length > 0) {
      const ids = await Promise.all(patch.manufacturers.map(manufacturerIdByName))
      unwrap(await client().from('vendor_manufacturers').insert(ids.map((manufacturer_id) => ({ vendor_id: id, manufacturer_id }))))
    }
  }
}

// ---------------------------------------------------------------------------
// Purchase Orders
// ---------------------------------------------------------------------------

export async function fetchPurchaseOrders(workspaceId: string): Promise<PurchaseOrder[]> {
  const [pos, lines, events] = await Promise.all([
    unwrap(await client().from('purchase_orders').select('*').eq('workspace_id', workspaceId).order('created_at', { ascending: false })),
    unwrap(await client().from('purchase_order_lines').select('*').eq('workspace_id', workspaceId)),
    unwrap(await client().from('purchase_order_events').select('*').eq('workspace_id', workspaceId).order('event_date')),
  ])
  return pos.map((po) =>
    purchaseOrderFromDb(
      po,
      lines.filter((l) => l.po_id === po.id).map(poLineFromDb),
      events.filter((e) => e.po_id === po.id).map(poEventFromDb),
    ),
  )
}

export async function createPurchaseOrderRpc(
  workspaceId: string,
  poNumber: string,
  vendorId: string,
  lines: { productId: string; quantityOrdered: number; unitCost: number }[],
  eta: string,
  notes?: string,
): Promise<string> {
  return unwrap(
    await client().rpc('create_purchase_order', {
      p_workspace_id: workspaceId,
      p_po_number: poNumber,
      p_vendor_id: vendorId,
      p_eta: eta,
      p_lines: lines.map((l) => ({ product_id: l.productId, quantity_ordered: l.quantityOrdered, unit_cost: l.unitCost })),
      p_notes: notes ?? null,
    }),
  )
}

export async function submitPurchaseOrderRpc(poId: string): Promise<void> {
  unwrap(await client().rpc('submit_purchase_order', { p_po_id: poId }))
}

export async function cancelPurchaseOrderRpc(poId: string): Promise<void> {
  unwrap(await client().rpc('cancel_purchase_order', { p_po_id: poId }))
}

export async function attachPoPhotoRpc(poId: string, photoUrl: string | undefined): Promise<void> {
  unwrap(await client().rpc('attach_po_photo', { p_po_id: poId, p_photo_url: photoUrl ?? null }))
}

export async function receivePurchaseOrderRpc(
  poId: string,
  receipts: { lineId: string; quantityReceived: number; lotNumber?: string; expiryDate?: string }[],
  photoUrls?: string[],
): Promise<void> {
  unwrap(
    await client().rpc('receive_purchase_order', {
      p_po_id: poId,
      p_lines: receipts.map((r) => ({
        po_line_id: r.lineId,
        quantity: r.quantityReceived,
        lot_number: r.lotNumber ?? null,
        expiry_date: r.expiryDate ?? null,
      })),
      p_photo_urls: photoUrls ?? null,
    }),
  )
}

// ---------------------------------------------------------------------------
// Doctors
// ---------------------------------------------------------------------------

export async function fetchDoctors(workspaceId: string): Promise<Doctor[]> {
  const rows = unwrap(await client().from('doctors').select('*').eq('workspace_id', workspaceId).order('name'))
  return rows.map(doctorFromDb)
}

export async function insertDoctor(workspaceId: string, name: string, active = true): Promise<Doctor> {
  const row = unwrap<Row<'doctors'>>(await client().from('doctors').insert({ workspace_id: workspaceId, name, active }).select('*').single())
  return doctorFromDb(row)
}

export async function updateDoctorActive(id: string, active: boolean): Promise<void> {
  unwrap(await client().from('doctors').update({ active }).eq('id', id))
}

// ---------------------------------------------------------------------------
// Patients
// ---------------------------------------------------------------------------

export async function fetchPatients(workspaceId: string): Promise<Patient[]> {
  const rows = unwrap(await client().from('patients').select('*').eq('workspace_id', workspaceId).order('created_at', { ascending: false }))
  return rows.map(patientFromDb)
}

export async function insertPatient(workspaceId: string, input: Omit<Patient, 'id' | 'patientCode' | 'createdAt'>): Promise<Patient> {
  const count = await countRows(client().from('patients').select('id', { count: 'exact', head: true }).eq('workspace_id', workspaceId))
  const patientCode = `PT-${pad(1000 + count + 1, 5)}`
  const row = unwrap<Row<'patients'>>(
    await client()
      .from('patients')
      .insert({
        workspace_id: workspaceId,
        patient_code: patientCode,
        first_name: input.firstName,
        last_name: input.lastName,
        dob: input.dob,
        sex: input.sex,
        phone: input.phone,
        email: input.email,
        primary_doctor: input.primaryDoctor,
        notes: input.notes ?? null,
      })
      .select('*')
      .single(),
  )
  return patientFromDb(row)
}

export async function updatePatientRow(id: string, patch: Partial<Patient>): Promise<void> {
  const dbPatch: UpdatePatch<'patients'> = {}
  if (patch.firstName !== undefined) dbPatch.first_name = patch.firstName
  if (patch.lastName !== undefined) dbPatch.last_name = patch.lastName
  if (patch.dob !== undefined) dbPatch.dob = patch.dob
  if (patch.sex !== undefined) dbPatch.sex = patch.sex
  if (patch.phone !== undefined) dbPatch.phone = patch.phone
  if (patch.email !== undefined) dbPatch.email = patch.email
  if (patch.primaryDoctor !== undefined) dbPatch.primary_doctor = patch.primaryDoctor
  if (patch.notes !== undefined) dbPatch.notes = patch.notes
  unwrap(await client().from('patients').update(dbPatch).eq('id', id))
}

// ---------------------------------------------------------------------------
// Cases
// ---------------------------------------------------------------------------

export async function fetchCases(workspaceId: string): Promise<Case[]> {
  const [cases, usages, events] = await Promise.all([
    unwrap(await client().from('cases').select('*').eq('workspace_id', workspaceId).order('created_at', { ascending: false })),
    unwrap(await client().from('case_implant_usages').select('*').eq('workspace_id', workspaceId)),
    unwrap(await client().from('case_events').select('*').eq('workspace_id', workspaceId).order('event_date')),
  ])
  return cases.map((c) =>
    caseFromDb(
      c,
      usages.filter((u) => u.case_id === c.id).map(caseImplantUsageFromDb),
      events.filter((e) => e.case_id === c.id).map(caseEventFromDb),
    ),
  )
}

export async function insertCase(
  workspaceId: string,
  caseNumber: string,
  input: { patientId: string; doctor: string; labId?: string; status: Case['status']; procedure: string; scheduledDate?: string; notes?: string },
  actorName: string,
): Promise<Case> {
  const row = unwrap<Row<'cases'>>(
    await client()
      .from('cases')
      .insert({
        workspace_id: workspaceId,
        case_number: caseNumber,
        patient_id: input.patientId,
        doctor: input.doctor,
        lab_id: input.labId ?? null,
        status: caseStatusToDb(input.status),
        procedure_description: input.procedure,
        scheduled_date: input.scheduledDate ?? null,
        notes: input.notes ?? null,
      })
      .select('*')
      .single(),
  )
  const now = new Date().toISOString()
  unwrap(
    await client()
      .from('case_events')
      .insert({ workspace_id: workspaceId, case_id: row.id, label: 'Case Opened', description: 'Treatment plan created and case opened for patient.', actor: actorName, event_date: now }),
  )
  return caseFromDb(row, [], [{ id: 'pending', caseId: row.id, label: 'Case Opened', description: 'Treatment plan created and case opened for patient.', date: now, actor: actorName }])
}

export async function advanceCaseStatusRow(caseId: string, status: Case['status'], label: string, actorName: string): Promise<void> {
  const workspaceId = unwrap<Pick<Row<'cases'>, 'workspace_id'>>(await client().from('cases').select('workspace_id').eq('id', caseId).single()).workspace_id
  const now = new Date().toISOString()
  unwrap(
    await client()
      .from('cases')
      .update({ status: caseStatusToDb(status), completed_date: status === 'completed' ? now : undefined })
      .eq('id', caseId),
  )
  unwrap(await client().from('case_events').insert({ workspace_id: workspaceId, case_id: caseId, label, description: `Case status changed to ${label}.`, actor: actorName, event_date: now }))
}

export async function addImplantToCaseRpc(caseId: string, productId: string, tooth: string, quantity: number, unitPrice?: number, batchLot?: string): Promise<string> {
  return unwrap(
    await client().rpc('add_implant_to_case', {
      p_case_id: caseId,
      p_product_id: productId,
      p_tooth: tooth,
      p_quantity: quantity,
      p_unit_price: unitPrice ?? null,
      p_batch_lot: batchLot ?? null,
    }),
  )
}

// ---------------------------------------------------------------------------
// Labs
// ---------------------------------------------------------------------------

export async function fetchLabs(workspaceId: string): Promise<Lab[]> {
  const rows = unwrap(await client().from('labs').select('*').eq('workspace_id', workspaceId).order('name'))
  return rows.map(labFromDb)
}

export async function insertLab(workspaceId: string, input: Omit<Lab, 'id' | 'createdAt'>): Promise<Lab> {
  const row = unwrap<Row<'labs'>>(
    await client()
      .from('labs')
      .insert({
        workspace_id: workspaceId,
        name: input.name,
        contact_name: input.contactName,
        email: input.email,
        phone: input.phone,
        address: input.address,
        specialties: input.specialties,
        rating: input.rating,
        turnaround_days: input.turnaroundDays,
      })
      .select('*')
      .single(),
  )
  return labFromDb(row)
}

export async function updateLabRow(id: string, patch: Partial<Lab>): Promise<void> {
  const dbPatch: UpdatePatch<'labs'> = {}
  if (patch.name !== undefined) dbPatch.name = patch.name
  if (patch.contactName !== undefined) dbPatch.contact_name = patch.contactName
  if (patch.email !== undefined) dbPatch.email = patch.email
  if (patch.phone !== undefined) dbPatch.phone = patch.phone
  if (patch.address !== undefined) dbPatch.address = patch.address
  if (patch.specialties !== undefined) dbPatch.specialties = patch.specialties
  if (patch.rating !== undefined) dbPatch.rating = patch.rating
  if (patch.turnaroundDays !== undefined) dbPatch.turnaround_days = patch.turnaroundDays
  unwrap(await client().from('labs').update(dbPatch).eq('id', id))
}

// ---------------------------------------------------------------------------
// Sales
// ---------------------------------------------------------------------------

export async function fetchSales(workspaceId: string): Promise<Sale[]> {
  const [sales, lines] = await Promise.all([
    unwrap(await client().from('sales').select('*').eq('workspace_id', workspaceId).order('created_at', { ascending: false })),
    unwrap(await client().from('sale_lines').select('*').eq('workspace_id', workspaceId)),
  ])
  return sales.map((s) => saleFromDb(s, lines.filter((l) => l.sale_id === s.id).map(saleLineFromDb)))
}

export async function createSaleRpc(workspaceId: string, saleNumber: string, lines: SaleLine[], patientId: string, caseId?: string): Promise<string> {
  return unwrap(
    await client().rpc('create_sale', {
      p_workspace_id: workspaceId,
      p_sale_number: saleNumber,
      p_lines: lines.map((l) => ({ product_id: l.productId, quantity: l.quantity, unit_price: l.unitPrice, batch_lot: l.batchLot ?? null })),
      p_patient_id: patientId,
      p_case_id: caseId ?? null,
    }),
  )
}

export async function voidSaleRpc(saleId: string, reason: string): Promise<void> {
  unwrap(await client().rpc('void_sale', { p_sale_id: saleId, p_reason: reason }))
}

// ---------------------------------------------------------------------------
// Loans
// ---------------------------------------------------------------------------

export async function fetchLoans(workspaceId: string): Promise<Loan[]> {
  const [loans, lines, events] = await Promise.all([
    unwrap(await client().from('loans').select('*').eq('workspace_id', workspaceId).order('created_at', { ascending: false })),
    unwrap(await client().from('loan_lines').select('*').eq('workspace_id', workspaceId)),
    unwrap(await client().from('loan_events').select('*').eq('workspace_id', workspaceId).order('event_date')),
  ])
  return loans.map((l) =>
    loanFromDb(
      l,
      lines.filter((ln) => ln.loan_id === l.id).map(loanLineFromDb),
      events.filter((e) => e.loan_id === l.id).map(loanEventFromDb),
    ),
  )
}

export async function createLoanRpc(
  workspaceId: string,
  loanNumber: string,
  labId: string,
  lines: { productId: string; quantityLoaned: number; batchLot?: string }[],
  dueDate?: string,
  notes?: string,
): Promise<string> {
  return unwrap(
    await client().rpc('create_loan', {
      p_workspace_id: workspaceId,
      p_lab_id: labId,
      p_loan_number: loanNumber,
      p_lines: lines.map((l) => ({ product_id: l.productId, quantity: l.quantityLoaned, batch_lot: l.batchLot ?? null })),
      p_due_date: dueDate ?? null,
      p_notes: notes ?? null,
    }),
  )
}

export async function returnLoanLinesRpc(loanId: string, returns: { lineId: string; quantityReturned: number; quantityLost: number; lostReason?: string }[]): Promise<void> {
  unwrap(
    await client().rpc('return_loan_lines', {
      p_loan_id: loanId,
      p_returns: returns.map((r) => ({ line_id: r.lineId, quantity_returned: r.quantityReturned, quantity_lost: r.quantityLost, lost_reason: r.lostReason ?? null })),
    }),
  )
}

// ---------------------------------------------------------------------------
// Clinic settings
// ---------------------------------------------------------------------------

export async function fetchClinicSettings(workspaceId: string): Promise<ClinicSettings> {
  const row = unwrap<Row<'clinic_settings'>>(await client().from('clinic_settings').select('*').eq('workspace_id', workspaceId).single())
  return clinicSettingsFromDb(row)
}

export async function updateClinicSettingsRow(workspaceId: string, patch: Partial<ClinicSettings>): Promise<void> {
  unwrap(await client().from('clinic_settings').update(clinicSettingsToDb(patch)).eq('workspace_id', workspaceId))
}

// ---------------------------------------------------------------------------
// Numbering helpers — mirrors src/lib/idGenerator.ts's sequence formats, but
// derives the next number from a live count/lookup instead of an in-memory
// counter. Good enough for this app's realistic usage (a handful of staff
// per clinic); a genuine collision just surfaces as a unique-constraint
// error from the insert/RPC, which the caller can report and let the user retry.
// ---------------------------------------------------------------------------

export async function nextSaleNumber(workspaceId: string): Promise<string> {
  const year = new Date().getFullYear()
  const count = await countRows(client().from('sales').select('id', { count: 'exact', head: true }).eq('workspace_id', workspaceId).like('sale_number', `SL-${year}-%`))
  return `SL-${year}-${pad(count + 1, 5)}`
}

export async function nextLoanNumber(workspaceId: string): Promise<string> {
  const year = new Date().getFullYear()
  const count = await countRows(client().from('loans').select('id', { count: 'exact', head: true }).eq('workspace_id', workspaceId).like('loan_number', `LN-${year}-%`))
  return `LN-${year}-${pad(count + 1, 5)}`
}

export async function nextCaseNumber(workspaceId: string): Promise<string> {
  const year = new Date().getFullYear()
  const count = await countRows(client().from('cases').select('id', { count: 'exact', head: true }).eq('workspace_id', workspaceId).like('case_number', `IDC-${year}-%`))
  return `IDC-${year}-${pad(count + 1, 5)}`
}

export async function nextPoNumber(workspaceId: string): Promise<string> {
  const base =
    String(new Date().getFullYear()) +
    pad(new Date().getMonth() + 1, 2) +
    pad(new Date().getDate(), 2) +
    pad(new Date().getHours(), 2) +
    pad(new Date().getMinutes(), 2)
  const count = await countRows(client().from('purchase_orders').select('id', { count: 'exact', head: true }).eq('workspace_id', workspaceId).like('po_number', `${base}%`))
  return count === 0 ? base : `${base}-${count + 1}`
}
