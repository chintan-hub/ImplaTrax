/**
 * Populates a freshly created workspace with a realistic, self-contained
 * demo dataset — used by AuthContext's "Try Demo" onboarding path. Reuses
 * the same `src/mocks/*.ts` generators the app used for local dev seed data
 * before this migration, since their names/specs/pricing are already
 * realistic; the only thing that can't be reused as-is is cross-references
 * (mock vendor/product/patient ids don't exist in this workspace), so those
 * are remapped to the real ids this function gets back from each insert.
 */
import type { Manufacturer } from '@/types'
import * as mock from '@/mocks'
import {
  insertVendor, bulkInsertProducts, insertDoctor, insertPatient, insertLab, insertCase,
  adjustStockRpc, addImplantToCaseRpc, createSaleRpc, createLoanRpc, returnLoanLinesRpc, fetchLoans,
  createPurchaseOrderRpc, submitPurchaseOrderRpc, receivePurchaseOrderRpc, fetchPurchaseOrders,
  nextCaseNumber, nextSaleNumber, nextLoanNumber, nextPoNumber,
  updateClinicSettingsRow,
} from './queries'

const DEMO_VENDOR_COUNT = 3
const DEMO_PRODUCT_COUNT = 12
const DEMO_DOCTOR_COUNT = 3
const DEMO_PATIENT_COUNT = 6
const DEMO_LAB_COUNT = 2

export async function seedDemoWorkspace(workspaceId: string): Promise<void> {
  // Batch/lot tracking is off by default for a new workspace — turn it on
  // so the demo also shows off that feature (and gives the receiving PO
  // below something to attach lot numbers to).
  await updateClinicSettingsRow(workspaceId, { batchLotTrackingEnabled: true })

  const vendors = await Promise.all(
    mock.vendors.slice(0, DEMO_VENDOR_COUNT).map((v) =>
      insertVendor(workspaceId, {
        name: v.name, contactName: v.contactName, email: v.email, phone: v.phone,
        address: v.address, country: v.country, manufacturers: v.manufacturers,
      }),
    ),
  )
  const vendorIdForManufacturer = (m: Manufacturer) => vendors.find((v) => v.manufacturers.includes(m))?.id ?? vendors[0].id

  // A single batch insert (not N parallel insertProduct calls) — sku/barcode
  // both derive from a live per-workspace count, which N concurrent calls
  // would all read before any of them completed, handing out the same
  // sequence number to every product and colliding on the unique sku index.
  const productSpecs = mock.products.slice(0, DEMO_PRODUCT_COUNT)
  const products = await bulkInsertProducts(
    workspaceId,
    productSpecs.map((p) => ({
      name: p.name, manufacturer: p.manufacturer, category: p.category, system: p.system,
      diameterMm: p.diameterMm, lengthMm: p.lengthMm, platform: p.platform,
      unitCost: p.unitCost, unitPrice: p.unitPrice, priceVisible: p.priceVisible,
      quantityOnHand: 0, quantityReserved: 0, lowStockThreshold: p.lowStockThreshold,
      batchTracked: p.batchTracked, vendorId: vendorIdForManufacturer(p.manufacturer),
      imageColor: p.imageColor, description: p.description, status: p.status,
    })),
  )
  await Promise.all(products.map((p, i) => adjustStockRpc(p.id, productSpecs[i].quantityOnHand || 25, 'Initial stock (demo seed)')))

  const doctors = await Promise.all(mock.doctors.slice(0, DEMO_DOCTOR_COUNT).map((d) => insertDoctor(workspaceId, d.name, true)))
  const labs = await Promise.all(mock.labs.slice(0, DEMO_LAB_COUNT).map((l) =>
    insertLab(workspaceId, {
      name: l.name, contactName: l.contactName, email: l.email, phone: l.phone,
      address: l.address, specialties: l.specialties, rating: l.rating, turnaroundDays: l.turnaroundDays,
    }),
  ))
  // Sequential, not Promise.all — patient_code has the same live-count-based
  // sequence race as products did, and there's no bulk-insert helper for
  // patients to sidestep it with (only a handful of rows, so the extra
  // round trips are cheap).
  const patients = []
  for (let i = 0; i < Math.min(DEMO_PATIENT_COUNT, mock.patients.length); i++) {
    const p = mock.patients[i]
    patients.push(
      await insertPatient(workspaceId, {
        firstName: p.firstName, lastName: p.lastName, dob: p.dob, sex: p.sex,
        phone: p.phone, email: p.email, primaryDoctor: `Dr. ${doctors[i % doctors.length].name}`, notes: p.notes,
      }),
    )
  }

  // A few open/completed cases, each with one implant placed — placing an
  // implant deducts stock and records a linked sale automatically (same
  // add_implant_to_case RPC every real case uses).
  for (let i = 0; i < Math.min(4, patients.length); i++) {
    const caseNumber = await nextCaseNumber(workspaceId)
    const caseRecord = await insertCase(
      workspaceId,
      caseNumber,
      {
        patientId: patients[i].id,
        doctor: `Dr. ${doctors[i % doctors.length].name}`,
        labId: i % 2 === 0 ? labs[0]?.id : undefined,
        status: i === 0 ? 'completed' : i === 1 ? 'in-progress' : 'planning',
        procedure: ['Single Tooth Implant', 'Implant-Supported Bridge', 'Sinus Lift + Delayed Implant', 'Immediate Implant Placement'][i % 4],
      },
      'Demo Seed',
    )
    const product = products[i % products.length]
    await addImplantToCaseRpc(caseRecord.id, product.id, String(11 + i * 5), 1, product.unitPrice)
  }

  // One standalone (not case-linked) sale.
  if (patients.length > 0 && products.length > 1) {
    const saleNumber = await nextSaleNumber(workspaceId)
    await createSaleRpc(
      workspaceId,
      saleNumber,
      [{ productId: products[1].id, quantity: 2, unitPrice: products[1].unitPrice }],
      patients[0].id,
    )
  }

  // One loan to a lab, with a partial return recorded against it.
  if (labs.length > 0 && products.length > 2) {
    const loanNumber = await nextLoanNumber(workspaceId)
    const loanId = await createLoanRpc(
      workspaceId,
      loanNumber,
      labs[0].id,
      [{ productId: products[2].id, quantityLoaned: 4 }],
      new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10),
      'Trial kit for upcoming case',
    )
    const loans = await fetchLoans(workspaceId)
    const line = loans.find((l) => l.id === loanId)?.lines[0]
    if (line) {
      await returnLoanLinesRpc(loanId, [{ lineId: line.id, quantityReturned: 2, quantityLost: 0 }])
    }
  }

  // One purchase order taken through its full lifecycle: draft -> submitted -> received (with lot numbers, since batch tracking is on).
  if (vendors.length > 0 && products.length > 3) {
    const poNumber = await nextPoNumber(workspaceId)
    const poId = await createPurchaseOrderRpc(
      workspaceId,
      poNumber,
      vendors[0].id,
      [{ productId: products[3].id, quantityOrdered: 20, unitCost: products[3].unitCost }],
      new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
      'Restocking order (demo seed)',
    )
    await submitPurchaseOrderRpc(poId)
    const purchaseOrders = await fetchPurchaseOrders(workspaceId)
    const line = purchaseOrders.find((po) => po.id === poId)?.lines[0]
    if (line) {
      await receivePurchaseOrderRpc(poId, [{ lineId: line.id, quantityReceived: 20, lotNumber: `LOT-${new Date().getFullYear()}-DEMO01` }])
    }
  }
}
