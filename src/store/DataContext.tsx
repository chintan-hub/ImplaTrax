import { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react'
import type {
  Product,
  ProductBatch,
  InventoryMovement,
  PurchaseOrder,
  PurchaseOrderEvent,
  Vendor,
  Doctor,
  Patient,
  Case,
  CaseStatus,
  CaseImplantUsage,
  CaseTimelineEvent,
  Lab,
  Sale,
  SaleLine,
  Loan,
  LoanEvent,
  AppUser,
  ClinicSettings,
  MovementType,
  POStatus,
} from '@/types'
import * as mock from '@/mocks'
import { currentUser } from '@/mocks/users'
import { nextInternalId, createSequence, createTimestampIdGenerator, getInternalIdCounter, restoreInternalIdCounter } from '@/lib/idGenerator'
import { canSubmitPO, canConfirmPO, canReceivePO, canCancelPO } from '@/lib/poWorkflow'
import { canAdvanceCaseStatus } from '@/lib/caseWorkflow'
import { canReturnLoan } from '@/lib/loanWorkflow'
import { loadPersistedSnapshot, savePersistedSnapshot } from './persistence'

// Loaded once at module scope — the same evaluation-order guarantee the
// sequence generators below already relied on for mock data. Restoring the
// ID counter here, before any nextInternalId() call in this session, is what
// keeps freshly-generated IDs from colliding with previously-persisted ones.
const persisted = loadPersistedSnapshot()
if (persisted) restoreInternalIdCounter(persisted.internalIdCounter)

/**
 * Business-rule validation lives here, in the action functions, not just in
 * the calling UI dialogs — this is the integration seam a future backend
 * will replace (see ARCHITECTURE.md §6.2/§8.2). Convention: a violated rule
 * throws a plain Error with a user-facing message. Every current UI caller
 * already prevents these inputs from reaching this layer, so this is a
 * backstop, not a new user-facing validation path.
 */
class BusinessRuleError extends Error {}

function pad(n: number, width: number) {
  return String(n).padStart(width, '0')
}

/**
 * Rejects a Sale/Loan submission that would take any product below zero on
 * hand — quantities are summed per product across every line first, since a
 * single submission can list the same product on more than one line
 * (AUDIT.md Executive Summary #2: applyQtyDelta silently floors at zero
 * instead of the transaction being rejected).
 */
function assertStockAvailable(products: Product[], requests: { productId: string; quantity: number }[]) {
  const requestedByProduct = new Map<string, number>()
  requests.forEach((r) => requestedByProduct.set(r.productId, (requestedByProduct.get(r.productId) ?? 0) + r.quantity))
  for (const [productId, requested] of requestedByProduct) {
    const product = products.find((p) => p.id === productId)
    const available = product?.quantityOnHand ?? 0
    if (requested > available) {
      throw new BusinessRuleError(`Not enough stock for ${product?.name ?? 'this product'} — only ${available} available, ${requested} requested.`)
    }
  }
}

/**
 * Tracks quantityOnHand per product across a single multi-line transaction
 * (PO receipt, sale, loan issue/return) so quantityBefore/quantityAfter on
 * each InventoryMovement stay correct even if the same product appears on
 * more than one line in that transaction — reading live `products` state
 * directly for every line would give every line after the first a stale,
 * pre-transaction "before" value (P1-N, locked 2026-07-29).
 */
function makeQtyTracker(products: Product[]) {
  const running = new Map<string, number>(products.map((p) => [p.id, p.quantityOnHand]))
  return (productId: string, delta: number) => {
    const before = running.get(productId) ?? 0
    const after = Math.max(0, before + delta)
    running.set(productId, after)
    return { before, after }
  }
}

// Human-readable sequence numbers (PO/loan/sale numbers, patient codes, Case
// IDs) — independent of live array length, seeded once from whichever data
// this session actually starts from: a persisted snapshot's array lengths if
// one exists, otherwise the mock seed counts (see src/lib/idGenerator.ts and
// ARCHITECTURE.md §6.3). Using the persisted length is safe because nothing
// in this app deletes records — array length and highest-assigned sequence
// number always match.
const nextProductSeq = createSequence((persisted?.products.length ?? mock.products.length) + 1)
const nextLoanSeq = createSequence((persisted?.loans.length ?? mock.loans.length) + 1)
const nextSaleSeq = createSequence((persisted?.sales.length ?? mock.sales.length) + 1)
const nextPatientSeq = createSequence((persisted?.patients.length ?? mock.patients.length) + 1)

// Purchase Order IDs are timestamp-based (YYYYMMDDHHmm), a business rule
// specific to this entity — see src/lib/idGenerator.ts.
const nextPoNumber = createTimestampIdGenerator()

// Case IDs reset per calendar year (IDC-YYYY-00001), so each year gets its
// own counter, lazily created and seeded from how many seeded cases already
// exist for that year.
const caseSeqByYear = new Map<number, () => number>()
function nextCaseSeq(year: number): number {
  if (!caseSeqByYear.has(year)) {
    const sourceCases = persisted?.cases ?? mock.cases
    const existing = sourceCases.filter((c) => c.caseId.includes(`-${year}-`)).length
    caseSeqByYear.set(year, createSequence(existing + 1))
  }
  return caseSeqByYear.get(year)!()
}

const CASE_STATUS_EVENT_LABEL: Record<CaseStatus, string> = {
  planning: 'Case Opened',
  'surgery-scheduled': 'Surgery Scheduled',
  'in-progress': 'Case In Progress',
  restoration: 'Restoration Phase',
  completed: 'Case Completed',
  cancelled: 'Case Cancelled',
}

interface DataContextValue {
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

  addMovement: (input: {
    productId: string
    type: MovementType
    quantity: number
    quantityBefore: number
    quantityAfter: number
    reason: string
    reference?: string
    note?: string
    batchLot?: string
    vendorId?: string
    labId?: string
    patientId?: string
    doctor?: string
    caseId?: string
  }) => void
  adjustStock: (productId: string, delta: number, reason: string, note?: string) => void
  addProduct: (input: Omit<Product, 'id' | 'sku' | 'barcode' | 'qrPayload' | 'createdAt' | 'updatedAt'>) => Product
  updateProduct: (id: string, patch: Partial<Product>) => void

  createPurchaseOrder: (vendorId: string, lines: { productId: string; quantityOrdered: number; unitCost: number }[], eta: string, notes?: string) => PurchaseOrder
  submitPurchaseOrder: (poId: string) => void
  confirmPurchaseOrder: (poId: string) => void
  receivePurchaseOrder: (poId: string, receipts: { lineId: string; quantityReceived: number; lotNumber?: string; expiryDate?: string }[]) => void
  cancelPurchaseOrder: (poId: string) => void
  attachPhotoToOrder: (poId: string, photoDataUrl: string | undefined) => void

  createLoan: (labId: string, lines: { productId: string; quantityLoaned: number; batchLot?: string }[], dueDate?: string, notes?: string) => Loan
  returnLoanLines: (loanId: string, returns: { lineId: string; quantityReturned: number; quantityLost: number; lostReason?: string }[]) => void

  createSale: (lines: SaleLine[], patientId?: string, caseId?: string) => Sale

  addPatient: (input: Omit<Patient, 'id' | 'patientCode' | 'createdAt'>) => Patient
  updatePatient: (id: string, patch: Partial<Patient>) => void
  addCase: (input: Omit<Case, 'id' | 'caseId' | 'createdAt' | 'implants' | 'history'> & { implants?: Case['implants'] }) => Case
  advanceCaseStatus: (caseId: string, status: CaseStatus) => void
  addImplantToCase: (caseId: string, usage: CaseImplantUsage) => void
  addLab: (input: Omit<Lab, 'id' | 'createdAt'>) => Lab
  addVendor: (input: Omit<Vendor, 'id' | 'createdAt' | 'totalOrders' | 'onTimeRate'>) => Vendor
  addUser: (input: Omit<AppUser, 'id' | 'createdAt'>) => AppUser
  updateClinicSettings: (patch: Partial<ClinicSettings>) => void
  addDoctor: (input: { name: string; active?: boolean }) => Doctor
}

const DataContext = createContext<DataContextValue | null>(null)

export function DataProvider({ children }: { children: React.ReactNode }) {
  const [products, setProducts] = useState<Product[]>(persisted?.products ?? mock.products)
  const [movements, setMovements] = useState<InventoryMovement[]>(persisted?.movements ?? mock.inventoryMovements)
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>(persisted?.purchaseOrders ?? mock.purchaseOrders)
  const [vendors, setVendors] = useState<Vendor[]>(persisted?.vendors ?? mock.vendors)
  const [patients, setPatients] = useState<Patient[]>(persisted?.patients ?? mock.patients)
  const [cases, setCases] = useState<Case[]>(persisted?.cases ?? mock.cases)
  const [labs, setLabs] = useState<Lab[]>(persisted?.labs ?? mock.labs)
  const [sales, setSales] = useState<Sale[]>(persisted?.sales ?? mock.sales)
  const [loans, setLoans] = useState<Loan[]>(persisted?.loans ?? mock.loans)
  const [users, setUsers] = useState<AppUser[]>(persisted?.users ?? mock.users)
  const [clinicSettings, setClinicSettings] = useState<ClinicSettings>(persisted?.clinicSettings ?? mock.defaultClinicSettings)
  const [batches, setBatches] = useState<ProductBatch[]>(persisted?.batches ?? mock.batches)
  const [doctors, setDoctors] = useState<Doctor[]>(persisted?.doctors ?? mock.doctors)

  const addMovement = useCallback<DataContextValue['addMovement']>((input) => {
    const movement: InventoryMovement = {
      id: nextInternalId('mv'),
      performedBy: currentUser.id,
      createdAt: new Date().toISOString(),
      ...input,
    }
    setMovements((prev) => [movement, ...prev])
  }, [])

  const applyQtyDelta = useCallback((productId: string, delta: number) => {
    setProducts((prev) => prev.map((p) => (p.id === productId ? { ...p, quantityOnHand: Math.max(0, p.quantityOnHand + delta), updatedAt: new Date().toISOString() } : p)))
  }, [])

  const adjustStock = useCallback(
    (productId: string, delta: number, reason: string, note?: string) => {
      if (!reason.trim()) throw new BusinessRuleError('A reason is required for manual stock adjustments.')
      const before = products.find((p) => p.id === productId)?.quantityOnHand ?? 0
      const after = Math.max(0, before + delta)
      applyQtyDelta(productId, delta)
      addMovement({ productId, type: 'adjustment', quantity: delta, quantityBefore: before, quantityAfter: after, reason, note })
    },
    [addMovement, applyQtyDelta, products],
  )

  const addProduct = useCallback<DataContextValue['addProduct']>((input) => {
    const id = nextInternalId('prd')
    const now = new Date().toISOString()
    const seq = nextProductSeq()
    const product: Product = {
      ...input,
      id,
      sku: `${input.manufacturer.slice(0, 3).toUpperCase()}-${input.system.slice(0, 4).toUpperCase()}-${pad(seq, 3)}`,
      barcode: `890${pad(2000000 + seq, 9)}`,
      qrPayload: `IMPD:PRD:${id}`,
      createdAt: now,
      updatedAt: now,
    }
    setProducts((prev) => [product, ...prev])
    if (product.quantityOnHand > 0) {
      addMovement({ productId: id, type: 'inbound', quantity: product.quantityOnHand, quantityBefore: 0, quantityAfter: product.quantityOnHand, reason: 'Initial stock on product creation' })
    }
    return product
  }, [addMovement])

  const updateProduct = useCallback((id: string, patch: Partial<Product>) => {
    setProducts((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch, updatedAt: new Date().toISOString() } : p)))
  }, [])

  const poEvent = useCallback((poId: string, label: string, description: string, date: string): PurchaseOrderEvent => {
    return { id: nextInternalId('poevt'), poId, label, description, date, actor: currentUser.name }
  }, [])

  // A Purchase Order never changes inventory itself — only receivePurchaseOrder
  // does, via applyQtyDelta below. createPurchaseOrder/submitPurchaseOrder/
  // confirmPurchaseOrder/cancelPurchaseOrder only ever touch PO status/history.
  const createPurchaseOrder = useCallback<DataContextValue['createPurchaseOrder']>((vendorId, lines, eta, notes) => {
    const id = nextInternalId('po')
    const now = new Date()
    const nowIso = now.toISOString()
    const po: PurchaseOrder = {
      id,
      poNumber: nextPoNumber(now),
      vendorId,
      status: 'draft',
      eta,
      createdAt: nowIso,
      lines: lines.map((l, i) => ({ id: `${id}_line_${i + 1}`, productId: l.productId, quantityOrdered: l.quantityOrdered, quantityReceived: 0, unitCost: l.unitCost })),
      notes,
      history: [poEvent(id, 'Purchase Order Created', `Draft created with ${lines.length} line item(s). Inventory is not affected until items are received.`, nowIso)],
    }
    setPurchaseOrders((prev) => [po, ...prev])
    return po
  }, [poEvent])

  const submitPurchaseOrder = useCallback((poId: string) => {
    const po = purchaseOrders.find((p) => p.id === poId)
    if (!po || !canSubmitPO(po)) throw new BusinessRuleError('Only a draft purchase order can be submitted.')
    const now = new Date().toISOString()
    setPurchaseOrders((prev) =>
      prev.map((p) =>
        p.id === poId
          ? { ...p, status: 'submitted' as POStatus, submittedAt: now, history: [...p.history, poEvent(poId, 'Submitted to Vendor', 'Purchase order sent to the vendor.', now)] }
          : p,
      ),
    )
  }, [purchaseOrders, poEvent])

  const confirmPurchaseOrder = useCallback((poId: string) => {
    const po = purchaseOrders.find((p) => p.id === poId)
    if (!po || !canConfirmPO(po)) throw new BusinessRuleError('Only a submitted purchase order can be confirmed.')
    const now = new Date().toISOString()
    setPurchaseOrders((prev) =>
      prev.map((p) =>
        p.id === poId
          ? {
              ...p,
              status: 'confirmed' as POStatus,
              confirmedAt: now,
              history: [...p.history, poEvent(poId, 'Confirmed by Vendor', 'Vendor confirmed the order. Inventory is still unaffected until items are received.', now)],
            }
          : p,
      ),
    )
  }, [purchaseOrders, poEvent])

  const receivePurchaseOrder = useCallback<DataContextValue['receivePurchaseOrder']>((poId, receipts) => {
    if (!receipts.some((r) => r.quantityReceived > 0)) {
      throw new BusinessRuleError('Enter a quantity to receive for at least one line.')
    }
    const po = purchaseOrders.find((p) => p.id === poId)
    if (!po || !canReceivePO(po)) throw new BusinessRuleError('This purchase order cannot be received in its current status.')

    // Batch/lot traceability begins here: with tracking on, every received
    // line needs a lot number captured the moment it enters the business —
    // this is not gated by Product.batchTracked (PROJECT.md §3 point 5).
    if (clinicSettings.batchLotTrackingEnabled) {
      for (const r of receipts) {
        if (r.quantityReceived <= 0) continue
        if (!r.lotNumber?.trim()) {
          const line = po.lines.find((l) => l.id === r.lineId)
          const product = line ? products.find((p) => p.id === line.productId) : undefined
          throw new BusinessRuleError(`A lot/batch number is required to receive ${product?.name ?? 'this line'}.`)
        }
      }
    }

    const now = new Date().toISOString()
    const updatedLines = po.lines.map((line) => {
      const receipt = receipts.find((r) => r.lineId === line.id)
      if (!receipt) return line
      return { ...line, quantityReceived: Math.min(line.quantityOrdered, line.quantityReceived + receipt.quantityReceived) }
    })
    const fullyReceived = updatedLines.every((l) => l.quantityReceived >= l.quantityOrdered)
    const anyReceived = updatedLines.some((l) => l.quantityReceived > 0)
    const status: POStatus = fullyReceived ? 'received' : anyReceived ? 'partially-received' : po.status
    const receivedThisTime = receipts.reduce((s, r) => s + Math.max(0, r.quantityReceived), 0)
    const event = fullyReceived
      ? poEvent(poId, 'Stock Fully Received', 'All ordered quantities have now been received; inventory updated.', now)
      : poEvent(poId, 'Stock Partially Received', `${receivedThisTime} unit(s) received in this receipt; inventory updated. Order remains open for the rest.`, now)

    setPurchaseOrders((prev) =>
      prev.map((p) =>
        p.id === poId
          ? { ...p, lines: updatedLines, status, receivedAt: fullyReceived ? now : p.receivedAt, history: [...p.history, event] }
          : p,
      ),
    )
    const newBatches: ProductBatch[] = []
    const track = makeQtyTracker(products)
    receipts.forEach((r) => {
      if (r.quantityReceived <= 0) return
      const line = po.lines.find((l) => l.id === r.lineId)
      if (!line) return
      const lotNumber = r.lotNumber?.trim()
      const { before, after } = track(line.productId, r.quantityReceived)
      applyQtyDelta(line.productId, r.quantityReceived)
      addMovement({
        productId: line.productId,
        type: 'inbound',
        quantity: r.quantityReceived,
        quantityBefore: before,
        quantityAfter: after,
        reason: 'Purchase order received',
        reference: po.poNumber,
        batchLot: lotNumber,
        vendorId: po.vendorId,
      })
      // Batches are append-only, like every other audit trail in this app —
      // the same lot number received across multiple receipts becomes
      // multiple ProductBatch records, aggregated by (productId, lotNumber)
      // wherever they're displayed, never merged/edited in place here.
      if (lotNumber) {
        newBatches.push({
          id: nextInternalId('batch'),
          productId: line.productId,
          lotNumber,
          expiryDate: r.expiryDate || undefined,
          quantity: r.quantityReceived,
          receivedAt: now,
          reference: po.poNumber,
        })
      }
    })
    if (newBatches.length > 0) setBatches((prev) => [...newBatches, ...prev])
  }, [purchaseOrders, products, poEvent, applyQtyDelta, addMovement, clinicSettings])

  const cancelPurchaseOrder = useCallback((poId: string) => {
    const po = purchaseOrders.find((p) => p.id === poId)
    if (!po || !canCancelPO(po)) throw new BusinessRuleError('This purchase order can no longer be cancelled.')
    const now = new Date().toISOString()
    setPurchaseOrders((prev) =>
      prev.map((p) =>
        p.id === poId
          ? { ...p, status: 'cancelled' as POStatus, history: [...p.history, poEvent(poId, 'Purchase Order Cancelled', 'This purchase order was cancelled and will not be received.', now)] }
          : p,
      ),
    )
  }, [purchaseOrders, poEvent])

  const attachPhotoToOrder = useCallback((poId: string, photoDataUrl: string | undefined) => {
    const now = new Date().toISOString()
    setPurchaseOrders((prev) =>
      prev.map((p) =>
        p.id === poId
          ? {
              ...p,
              photoDataUrl,
              history: [
                ...p.history,
                poEvent(poId, photoDataUrl ? 'Photo Attached' : 'Photo Removed', photoDataUrl ? 'A reference photo was attached to this purchase order.' : 'The attached photo was removed.', now),
              ],
            }
          : p,
      ),
    )
  }, [poEvent])

  const loanEvent = useCallback((loanId: string, label: string, description: string, date: string): LoanEvent => {
    return { id: nextInternalId('lnevt'), loanId, label, description, date, actor: currentUser.name }
  }, [])

  const createLoan = useCallback<DataContextValue['createLoan']>((labId, lines, dueDate, notes) => {
    if (!labs.some((l) => l.id === labId)) throw new BusinessRuleError('Loans can only be issued to a lab.')
    if (lines.length === 0) throw new BusinessRuleError('A loan must include at least one product line.')
    assertStockAvailable(products, lines.map((l) => ({ productId: l.productId, quantity: l.quantityLoaned })))
    const id = nextInternalId('ln')
    const seq = nextLoanSeq()
    const year = new Date().getFullYear()
    const now = new Date().toISOString()
    const loan: Loan = {
      id,
      loanNumber: `LN-${year}-${pad(seq, 5)}`,
      labId,
      status: 'open',
      lines: lines.map((l, i) => ({ id: `${id}_line_${i + 1}`, productId: l.productId, quantityLoaned: l.quantityLoaned, quantityReturned: 0, quantityLost: 0, batchLot: l.batchLot })),
      issuedBy: currentUser.id,
      issuedAt: now,
      dueDate,
      notes,
      history: [loanEvent(id, 'Loan Issued', `Loan issued with ${lines.length} product line(s).`, now)],
    }
    setLoans((prev) => [loan, ...prev])
    const track = makeQtyTracker(products)
    lines.forEach((l) => {
      const { before, after } = track(l.productId, -l.quantityLoaned)
      applyQtyDelta(l.productId, -l.quantityLoaned)
      addMovement({
        productId: l.productId,
        type: 'loan-out',
        quantity: -l.quantityLoaned,
        quantityBefore: before,
        quantityAfter: after,
        reason: 'Loan issued to lab',
        reference: loan.loanNumber,
        batchLot: l.batchLot,
        labId,
      })
    })
    return loan
  }, [labs, products, applyQtyDelta, addMovement, loanEvent])

  const returnLoanLines = useCallback<DataContextValue['returnLoanLines']>((loanId, returns) => {
    if (!returns.some((r) => r.quantityReturned > 0 || r.quantityLost > 0)) {
      throw new BusinessRuleError('Enter a returned or lost quantity for at least one item.')
    }
    if (returns.some((r) => r.quantityLost > 0 && !r.lostReason?.trim())) {
      throw new BusinessRuleError('A reason is required for any lost components.')
    }
    const loan = loans.find((l) => l.id === loanId)
    if (!loan || !canReturnLoan(loan)) throw new BusinessRuleError('This loan has already been closed and can no longer be returned against.')

    const now = new Date().toISOString()
    const returnedThisTime = returns.reduce((s, r) => s + Math.max(0, r.quantityReturned), 0)
    const lostThisTime = returns.reduce((s, r) => s + Math.max(0, r.quantityLost), 0)

    setLoans((prev) =>
      prev.map((l) => {
        if (l.id !== loanId) return l
        const lines = l.lines.map((line) => {
          const r = returns.find((x) => x.lineId === line.id)
          if (!r) return line
          return {
            ...line,
            quantityReturned: line.quantityReturned + r.quantityReturned,
            quantityLost: line.quantityLost + r.quantityLost,
            lostReason: r.lostReason ?? line.lostReason,
          }
        })
        const fullyClosed = lines.every((ln) => ln.quantityReturned + ln.quantityLost >= ln.quantityLoaned)
        const anyReturned = lines.some((ln) => ln.quantityReturned + ln.quantityLost > 0)
        const status: Loan['status'] = fullyClosed ? 'closed' : anyReturned ? 'partially-returned' : l.status
        const event = fullyClosed
          ? loanEvent(loanId, 'Loan Closed', `${returnedThisTime} returned, ${lostThisTime} lost in this return; all outstanding items are now accounted for.`, now)
          : loanEvent(loanId, 'Partial Return Recorded', `${returnedThisTime} returned, ${lostThisTime} lost in this return; some items remain outstanding.`, now)
        return { ...l, lines, status, closedAt: fullyClosed ? now : l.closedAt, history: [...l.history, event] }
      }),
    )
    const track = makeQtyTracker(products)
    returns.forEach((r) => {
      const line = loan.lines.find((l) => l.id === r.lineId)
      if (!line) return
      // The lot a line returns to is always the same lot it was issued
      // against — read off the existing LoanLine rather than asking the
      // user to re-enter it (nothing about a loan return changes which
      // physical lot the item belongs to).
      if (r.quantityReturned > 0) {
        const { before, after } = track(line.productId, r.quantityReturned)
        applyQtyDelta(line.productId, r.quantityReturned)
        addMovement({
          productId: line.productId,
          type: 'loan-return',
          quantity: r.quantityReturned,
          quantityBefore: before,
          quantityAfter: after,
          reason: 'Loan components returned by lab',
          reference: loan.loanNumber,
          batchLot: line.batchLot,
          labId: loan.labId,
        })
      }
      if (r.quantityLost > 0) {
        // Lost stock was already decremented when the loan was issued
        // (loan-out) — this movement only records disposition, so it does
        // not call applyQtyDelta and before === after (quantityOnHand is
        // unaffected by this event).
        const { before, after } = track(line.productId, 0)
        addMovement({
          productId: line.productId,
          type: 'lost',
          quantity: -r.quantityLost,
          quantityBefore: before,
          quantityAfter: after,
          reason: r.lostReason || 'Component lost while on loan',
          reference: loan.loanNumber,
          batchLot: line.batchLot,
          labId: loan.labId,
        })
      }
    })
  }, [loans, products, applyQtyDelta, addMovement, loanEvent])

  const createSale = useCallback<DataContextValue['createSale']>((lines, patientId, caseId) => {
    if (lines.length === 0) throw new BusinessRuleError('A sale must include at least one product line.')
    assertStockAvailable(products, lines.map((l) => ({ productId: l.productId, quantity: l.quantity })))
    const id = nextInternalId('sal')
    const seq = nextSaleSeq()
    const year = new Date().getFullYear()
    const sale: Sale = {
      id,
      saleNumber: `SL-${year}-${pad(seq, 5)}`,
      patientId,
      caseId,
      lines,
      total: lines.reduce((sum, l) => sum + l.unitPrice * l.quantity, 0),
      soldBy: currentUser.id,
      createdAt: new Date().toISOString(),
    }
    setSales((prev) => [sale, ...prev])
    // Doctor is only ever knowable via a case link — Sale itself has no
    // doctor field, matching PROJECT.md §3's Doctor decision (a display
    // string, not a FK, sourced from wherever a Case already carries it).
    const doctor = caseId ? cases.find((c) => c.id === caseId)?.doctor : undefined
    const track = makeQtyTracker(products)
    lines.forEach((l) => {
      const { before, after } = track(l.productId, -l.quantity)
      applyQtyDelta(l.productId, -l.quantity)
      addMovement({
        productId: l.productId,
        type: 'sale',
        quantity: -l.quantity,
        quantityBefore: before,
        quantityAfter: after,
        reason: caseId ? 'Used in patient case' : 'Direct sale',
        reference: sale.saleNumber,
        batchLot: l.batchLot,
        patientId,
        caseId,
        doctor,
      })
    })
    return sale
  }, [products, cases, applyQtyDelta, addMovement])

  const addPatient = useCallback<DataContextValue['addPatient']>((input) => {
    const id = nextInternalId('pat')
    const patient: Patient = { ...input, id, patientCode: `PT-${pad(1000 + nextPatientSeq(), 5)}`, createdAt: new Date().toISOString() }
    setPatients((prev) => [patient, ...prev])
    return patient
  }, [])

  const updatePatient = useCallback<DataContextValue['updatePatient']>((id, patch) => {
    setPatients((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)))
  }, [])

  const caseEvent = useCallback((caseId: string, label: string, description: string, date: string): CaseTimelineEvent => {
    return { id: nextInternalId('cseevt'), caseId, label, description, date, actor: currentUser.name }
  }, [])

  const addCase = useCallback<DataContextValue['addCase']>((input) => {
    const id = nextInternalId('cse')
    const year = new Date().getFullYear()
    const now = new Date().toISOString()
    const caseRecord: Case = {
      ...input,
      id,
      caseId: `IDC-${year}-${pad(nextCaseSeq(year), 5)}`,
      createdAt: now,
      implants: input.implants ?? [],
      history: [caseEvent(id, 'Case Opened', 'Treatment plan created and case opened for patient.', now)],
    }
    setCases((prev) => [caseRecord, ...prev])
    return caseRecord
  }, [caseEvent])

  const advanceCaseStatus = useCallback<DataContextValue['advanceCaseStatus']>((caseId, status) => {
    const caseRecord = cases.find((c) => c.id === caseId)
    if (!caseRecord || !canAdvanceCaseStatus(caseRecord, status)) {
      throw new BusinessRuleError('This case cannot move to that status from its current status.')
    }
    const now = new Date().toISOString()
    const label = CASE_STATUS_EVENT_LABEL[status]
    setCases((prev) =>
      prev.map((c) =>
        c.id === caseId
          ? {
              ...c,
              status,
              completedDate: status === 'completed' ? now : c.completedDate,
              history: [...c.history, caseEvent(caseId, label, `Case status changed to ${label}.`, now)],
            }
          : c,
      ),
    )
  }, [cases, caseEvent])

  // Recording that an implant was used in a case is independent of stock
  // movement — createSale (with a caseId) is the code path that actually
  // decrements inventory for a case-linked component; this action only
  // maintains the case's own implant/timeline record.
  const addImplantToCase = useCallback<DataContextValue['addImplantToCase']>((caseId, usage) => {
    if (!usage.tooth.trim()) throw new BusinessRuleError('A tooth number is required.')
    if (usage.quantity <= 0) throw new BusinessRuleError('Quantity must be greater than zero.')
    const caseRecord = cases.find((c) => c.id === caseId)
    if (!caseRecord) throw new BusinessRuleError('Case not found.')
    const product = products.find((p) => p.id === usage.productId)
    const now = new Date().toISOString()
    setCases((prev) =>
      prev.map((c) =>
        c.id === caseId
          ? {
              ...c,
              implants: [...c.implants, usage],
              history: [
                ...c.history,
                caseEvent(caseId, 'Implant Added', `${product?.name ?? 'Implant'} added to case (tooth #${usage.tooth}).`, now),
              ],
            }
          : c,
      ),
    )
  }, [cases, products, caseEvent])

  const addLab = useCallback<DataContextValue['addLab']>((input) => {
    const id = nextInternalId('lab')
    const lab: Lab = { ...input, id, createdAt: new Date().toISOString() }
    setLabs((prev) => [lab, ...prev])
    return lab
  }, [])

  const addVendor = useCallback<DataContextValue['addVendor']>((input) => {
    const id = nextInternalId('vnd')
    const vendor: Vendor = { ...input, id, totalOrders: 0, onTimeRate: 1, createdAt: new Date().toISOString() }
    setVendors((prev) => [vendor, ...prev])
    return vendor
  }, [])

  const addUser = useCallback<DataContextValue['addUser']>((input) => {
    const id = nextInternalId('usr')
    const user: AppUser = { ...input, id, createdAt: new Date().toISOString() }
    setUsers((prev) => [user, ...prev])
    return user
  }, [])

  const updateClinicSettings = useCallback((patch: Partial<ClinicSettings>) => {
    setClinicSettings((prev) => ({ ...prev, ...patch }))
  }, [])

  const addDoctor = useCallback<DataContextValue['addDoctor']>((input) => {
    const id = nextInternalId('doc')
    const doctor: Doctor = { name: input.name, active: input.active ?? true, id, createdAt: new Date().toISOString() }
    setDoctors((prev) => [doctor, ...prev])
    return doctor
  }, [])

  const value = useMemo<DataContextValue>(
    () => ({
      products,
      movements,
      purchaseOrders,
      vendors,
      patients,
      cases,
      labs,
      sales,
      loans,
      users,
      clinicSettings,
      batches,
      doctors,
      addMovement,
      adjustStock,
      addProduct,
      updateProduct,
      createPurchaseOrder,
      submitPurchaseOrder,
      confirmPurchaseOrder,
      receivePurchaseOrder,
      cancelPurchaseOrder,
      attachPhotoToOrder,
      createLoan,
      returnLoanLines,
      createSale,
      addPatient,
      updatePatient,
      addCase,
      advanceCaseStatus,
      addImplantToCase,
      addLab,
      addVendor,
      addUser,
      updateClinicSettings,
      addDoctor,
    }),
    [
      products,
      movements,
      purchaseOrders,
      vendors,
      patients,
      cases,
      labs,
      sales,
      loans,
      users,
      clinicSettings,
      batches,
      doctors,
      addMovement,
      adjustStock,
      addProduct,
      updateProduct,
      createPurchaseOrder,
      submitPurchaseOrder,
      confirmPurchaseOrder,
      receivePurchaseOrder,
      cancelPurchaseOrder,
      attachPhotoToOrder,
      createLoan,
      returnLoanLines,
      createSale,
      addPatient,
      updatePatient,
      addCase,
      advanceCaseStatus,
      addImplantToCase,
      addLab,
      addVendor,
      addUser,
      updateClinicSettings,
      addDoctor,
    ],
  )

  // Persist every business-data slice on every change — there is no backend,
  // so this is the only thing standing between a user's work and losing it
  // on the next reload.
  useEffect(() => {
    savePersistedSnapshot({
      products,
      movements,
      purchaseOrders,
      vendors,
      patients,
      cases,
      labs,
      sales,
      loans,
      users,
      clinicSettings,
      batches,
      doctors,
      internalIdCounter: getInternalIdCounter(),
    })
  }, [products, movements, purchaseOrders, vendors, patients, cases, labs, sales, loans, users, clinicSettings, batches, doctors])

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>
}

export function useData() {
  const ctx = useContext(DataContext)
  if (!ctx) throw new Error('useData must be used within DataProvider')
  return ctx
}
