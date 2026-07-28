import { createContext, useContext, useMemo, useState, useCallback } from 'react'
import type {
  Product,
  InventoryMovement,
  PurchaseOrder,
  PurchaseOrderEvent,
  Vendor,
  Patient,
  Case,
  CaseStatus,
  CaseImplantUsage,
  CaseTimelineEvent,
  Lab,
  Sale,
  SaleLine,
  Loan,
  AppUser,
  ClinicSettings,
  MovementType,
  POStatus,
} from '@/types'
import * as mock from '@/mocks'
import { currentUser } from '@/mocks/users'
import { nextInternalId, createSequence, createTimestampIdGenerator } from '@/lib/idGenerator'
import { canSubmitPO, canConfirmPO, canReceivePO, canCancelPO } from '@/lib/poWorkflow'
import { canAdvanceCaseStatus } from '@/lib/caseWorkflow'

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

// Human-readable sequence numbers (PO/loan/sale numbers, patient codes, Case
// IDs) — independent of live array length, seeded once from the mock seed
// counts (see src/lib/idGenerator.ts and ARCHITECTURE.md §6.3).
const nextProductSeq = createSequence(mock.products.length + 1)
const nextLoanSeq = createSequence(mock.loans.length + 1)
const nextSaleSeq = createSequence(mock.sales.length + 1)
const nextPatientSeq = createSequence(mock.patients.length + 1)

// Purchase Order IDs are timestamp-based (YYYYMMDDHHmm), a business rule
// specific to this entity — see src/lib/idGenerator.ts.
const nextPoNumber = createTimestampIdGenerator()

// Case IDs reset per calendar year (IDC-YYYY-00001), so each year gets its
// own counter, lazily created and seeded from how many seeded cases already
// exist for that year.
const caseSeqByYear = new Map<number, () => number>()
function nextCaseSeq(year: number): number {
  if (!caseSeqByYear.has(year)) {
    const existing = mock.cases.filter((c) => c.caseId.includes(`-${year}-`)).length
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

  addMovement: (productId: string, type: MovementType, quantity: number, reason: string, reference?: string, note?: string) => void
  adjustStock: (productId: string, delta: number, reason: string, note?: string) => void
  addProduct: (input: Omit<Product, 'id' | 'sku' | 'barcode' | 'qrPayload' | 'createdAt' | 'updatedAt'>) => Product
  updateProduct: (id: string, patch: Partial<Product>) => void

  createPurchaseOrder: (vendorId: string, lines: { productId: string; quantityOrdered: number; unitCost: number }[], eta: string, notes?: string) => PurchaseOrder
  submitPurchaseOrder: (poId: string) => void
  confirmPurchaseOrder: (poId: string) => void
  receivePurchaseOrder: (poId: string, receipts: { lineId: string; quantityReceived: number }[]) => void
  cancelPurchaseOrder: (poId: string) => void
  attachPhotoToOrder: (poId: string, photoDataUrl: string | undefined) => void

  createLoan: (labId: string, lines: { productId: string; quantityLoaned: number }[], dueDate?: string, notes?: string) => Loan
  returnLoanLines: (loanId: string, returns: { lineId: string; quantityReturned: number; quantityLost: number; lostReason?: string }[]) => void

  createSale: (lines: SaleLine[], patientId?: string, caseId?: string) => Sale

  addPatient: (input: Omit<Patient, 'id' | 'patientCode' | 'createdAt'>) => Patient
  addCase: (input: Omit<Case, 'id' | 'caseId' | 'createdAt' | 'implants' | 'history'> & { implants?: Case['implants'] }) => Case
  advanceCaseStatus: (caseId: string, status: CaseStatus) => void
  addImplantToCase: (caseId: string, usage: CaseImplantUsage) => void
  addLab: (input: Omit<Lab, 'id' | 'createdAt'>) => Lab
  addVendor: (input: Omit<Vendor, 'id' | 'createdAt' | 'totalOrders' | 'onTimeRate'>) => Vendor
  addUser: (input: Omit<AppUser, 'id' | 'createdAt'>) => AppUser
  updateClinicSettings: (patch: Partial<ClinicSettings>) => void
}

const DataContext = createContext<DataContextValue | null>(null)

export function DataProvider({ children }: { children: React.ReactNode }) {
  const [products, setProducts] = useState<Product[]>(mock.products)
  const [movements, setMovements] = useState<InventoryMovement[]>(mock.inventoryMovements)
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>(mock.purchaseOrders)
  const [vendors, setVendors] = useState<Vendor[]>(mock.vendors)
  const [patients, setPatients] = useState<Patient[]>(mock.patients)
  const [cases, setCases] = useState<Case[]>(mock.cases)
  const [labs, setLabs] = useState<Lab[]>(mock.labs)
  const [sales, setSales] = useState<Sale[]>(mock.sales)
  const [loans, setLoans] = useState<Loan[]>(mock.loans)
  const [users, setUsers] = useState<AppUser[]>(mock.users)
  const [clinicSettings, setClinicSettings] = useState<ClinicSettings>(mock.defaultClinicSettings)

  const addMovement = useCallback(
    (productId: string, type: MovementType, quantity: number, reason: string, reference?: string, note?: string) => {
      const movement: InventoryMovement = {
        id: nextInternalId('mv'),
        productId,
        type,
        quantity,
        reason,
        reference,
        performedBy: currentUser.id,
        createdAt: new Date().toISOString(),
        note,
      }
      setMovements((prev) => [movement, ...prev])
    },
    [],
  )

  const applyQtyDelta = useCallback((productId: string, delta: number) => {
    setProducts((prev) => prev.map((p) => (p.id === productId ? { ...p, quantityOnHand: Math.max(0, p.quantityOnHand + delta), updatedAt: new Date().toISOString() } : p)))
  }, [])

  const adjustStock = useCallback(
    (productId: string, delta: number, reason: string, note?: string) => {
      if (!reason.trim()) throw new BusinessRuleError('A reason is required for manual stock adjustments.')
      applyQtyDelta(productId, delta)
      addMovement(productId, 'adjustment', delta, reason, undefined, note)
    },
    [addMovement, applyQtyDelta],
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
      addMovement(id, 'inbound', product.quantityOnHand, 'Initial stock on product creation')
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
    receipts.forEach((r) => {
      if (r.quantityReceived <= 0) return
      const line = po.lines.find((l) => l.id === r.lineId)
      if (!line) return
      applyQtyDelta(line.productId, r.quantityReceived)
      addMovement(line.productId, 'inbound', r.quantityReceived, 'Purchase order received', po.poNumber)
    })
  }, [purchaseOrders, poEvent, applyQtyDelta, addMovement])

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

  const createLoan = useCallback<DataContextValue['createLoan']>((labId, lines, dueDate, notes) => {
    if (!labs.some((l) => l.id === labId)) throw new BusinessRuleError('Loans can only be issued to a lab.')
    if (lines.length === 0) throw new BusinessRuleError('A loan must include at least one product line.')
    assertStockAvailable(products, lines.map((l) => ({ productId: l.productId, quantity: l.quantityLoaned })))
    const id = nextInternalId('ln')
    const seq = nextLoanSeq()
    const year = new Date().getFullYear()
    const loan: Loan = {
      id,
      loanNumber: `LN-${year}-${pad(seq, 5)}`,
      labId,
      status: 'open',
      lines: lines.map((l, i) => ({ id: `${id}_line_${i + 1}`, productId: l.productId, quantityLoaned: l.quantityLoaned, quantityReturned: 0, quantityLost: 0 })),
      issuedBy: currentUser.id,
      issuedAt: new Date().toISOString(),
      dueDate,
      notes,
    }
    setLoans((prev) => [loan, ...prev])
    lines.forEach((l) => {
      applyQtyDelta(l.productId, -l.quantityLoaned)
      addMovement(l.productId, 'loan-out', -l.quantityLoaned, 'Loan issued to lab', loan.loanNumber)
    })
    return loan
  }, [labs, products, applyQtyDelta, addMovement])

  const returnLoanLines = useCallback<DataContextValue['returnLoanLines']>((loanId, returns) => {
    if (!returns.some((r) => r.quantityReturned > 0 || r.quantityLost > 0)) {
      throw new BusinessRuleError('Enter a returned or lost quantity for at least one item.')
    }
    if (returns.some((r) => r.quantityLost > 0 && !r.lostReason?.trim())) {
      throw new BusinessRuleError('A reason is required for any lost components.')
    }
    setLoans((prev) =>
      prev.map((loan) => {
        if (loan.id !== loanId) return loan
        const lines = loan.lines.map((line) => {
          const r = returns.find((x) => x.lineId === line.id)
          if (!r) return line
          return {
            ...line,
            quantityReturned: line.quantityReturned + r.quantityReturned,
            quantityLost: line.quantityLost + r.quantityLost,
            lostReason: r.lostReason ?? line.lostReason,
          }
        })
        const fullyClosed = lines.every((l) => l.quantityReturned + l.quantityLost >= l.quantityLoaned)
        const anyReturned = lines.some((l) => l.quantityReturned + l.quantityLost > 0)
        const status: Loan['status'] = fullyClosed ? 'closed' : anyReturned ? 'partially-returned' : loan.status
        return { ...loan, lines, status, closedAt: fullyClosed ? new Date().toISOString() : loan.closedAt }
      }),
    )
    const loan = loans.find((l) => l.id === loanId)
    returns.forEach((r) => {
      const line = loan?.lines.find((l) => l.id === r.lineId)
      if (!line) return
      if (r.quantityReturned > 0) {
        applyQtyDelta(line.productId, r.quantityReturned)
        addMovement(line.productId, 'loan-return', r.quantityReturned, 'Loan components returned by lab', loan?.loanNumber)
      }
      if (r.quantityLost > 0) {
        addMovement(line.productId, 'lost', -r.quantityLost, r.lostReason || 'Component lost while on loan', loan?.loanNumber)
      }
    })
  }, [loans, applyQtyDelta, addMovement])

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
    lines.forEach((l) => {
      applyQtyDelta(l.productId, -l.quantity)
      addMovement(l.productId, 'sale', -l.quantity, caseId ? 'Used in patient case' : 'Direct sale', sale.saleNumber)
    })
    return sale
  }, [products, applyQtyDelta, addMovement])

  const addPatient = useCallback<DataContextValue['addPatient']>((input) => {
    const id = nextInternalId('pat')
    const patient: Patient = { ...input, id, patientCode: `PT-${pad(1000 + nextPatientSeq(), 5)}`, createdAt: new Date().toISOString() }
    setPatients((prev) => [patient, ...prev])
    return patient
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
      addCase,
      advanceCaseStatus,
      addImplantToCase,
      addLab,
      addVendor,
      addUser,
      updateClinicSettings,
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
      addCase,
      advanceCaseStatus,
      addImplantToCase,
      addLab,
      addVendor,
      addUser,
      updateClinicSettings,
    ],
  )

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>
}

export function useData() {
  const ctx = useContext(DataContext)
  if (!ctx) throw new Error('useData must be used within DataProvider')
  return ctx
}
