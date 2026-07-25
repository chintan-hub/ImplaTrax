import { createContext, useContext, useMemo, useState, useCallback } from 'react'
import type {
  Product,
  InventoryMovement,
  PurchaseOrder,
  Vendor,
  Patient,
  Case,
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

let idCounter = 100000

function nextId(prefix: string) {
  idCounter += 1
  return `${prefix}_${idCounter}`
}

function pad(n: number, width: number) {
  return String(n).padStart(width, '0')
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
  receivePurchaseOrder: (poId: string, receipts: { lineId: string; quantityReceived: number }[]) => void
  cancelPurchaseOrder: (poId: string) => void

  createLoan: (labId: string, lines: { productId: string; quantityLoaned: number }[], dueDate?: string, notes?: string) => Loan
  returnLoanLines: (loanId: string, returns: { lineId: string; quantityReturned: number; quantityLost: number; lostReason?: string }[]) => void

  createSale: (lines: SaleLine[], patientId?: string, caseId?: string) => Sale

  addPatient: (input: Omit<Patient, 'id' | 'patientCode' | 'createdAt'>) => Patient
  addCase: (input: Omit<Case, 'id' | 'caseId' | 'createdAt' | 'implants'> & { implants?: Case['implants'] }) => Case
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
        id: nextId('mv'),
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
      applyQtyDelta(productId, delta)
      addMovement(productId, 'adjustment', delta, reason, undefined, note)
    },
    [addMovement, applyQtyDelta],
  )

  const addProduct = useCallback<DataContextValue['addProduct']>((input) => {
    const id = nextId('prd')
    const now = new Date().toISOString()
    const seq = products.length + 1
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
  }, [products.length, addMovement])

  const updateProduct = useCallback((id: string, patch: Partial<Product>) => {
    setProducts((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch, updatedAt: new Date().toISOString() } : p)))
  }, [])

  const createPurchaseOrder = useCallback<DataContextValue['createPurchaseOrder']>((vendorId, lines, eta, notes) => {
    const id = nextId('po')
    const seq = purchaseOrders.length + 1
    const year = new Date().getFullYear()
    const po: PurchaseOrder = {
      id,
      poNumber: `PO-${year}-${pad(seq, 4)}`,
      vendorId,
      status: 'draft',
      eta,
      createdAt: new Date().toISOString(),
      lines: lines.map((l, i) => ({ id: `${id}_line_${i + 1}`, productId: l.productId, quantityOrdered: l.quantityOrdered, quantityReceived: 0, unitCost: l.unitCost })),
      notes,
    }
    setPurchaseOrders((prev) => [po, ...prev])
    return po
  }, [purchaseOrders.length])

  const submitPurchaseOrder = useCallback((poId: string) => {
    setPurchaseOrders((prev) =>
      prev.map((po) => (po.id === poId ? { ...po, status: 'submitted' as POStatus, submittedAt: new Date().toISOString() } : po)),
    )
  }, [])

  const receivePurchaseOrder = useCallback<DataContextValue['receivePurchaseOrder']>((poId, receipts) => {
    setPurchaseOrders((prev) =>
      prev.map((po) => {
        if (po.id !== poId) return po
        const lines = po.lines.map((line) => {
          const receipt = receipts.find((r) => r.lineId === line.id)
          if (!receipt) return line
          return { ...line, quantityReceived: Math.min(line.quantityOrdered, line.quantityReceived + receipt.quantityReceived) }
        })
        const fullyReceived = lines.every((l) => l.quantityReceived >= l.quantityOrdered)
        const anyReceived = lines.some((l) => l.quantityReceived > 0)
        const status: POStatus = fullyReceived ? 'received' : anyReceived ? 'partially-received' : po.status
        return { ...po, lines, status, receivedAt: fullyReceived ? new Date().toISOString() : po.receivedAt }
      }),
    )
    const po = purchaseOrders.find((p) => p.id === poId)
    receipts.forEach((r) => {
      if (r.quantityReceived <= 0) return
      const line = po?.lines.find((l) => l.id === r.lineId)
      if (!line) return
      applyQtyDelta(line.productId, r.quantityReceived)
      addMovement(line.productId, 'inbound', r.quantityReceived, 'Purchase order received', po?.poNumber)
    })
  }, [purchaseOrders, applyQtyDelta, addMovement])

  const cancelPurchaseOrder = useCallback((poId: string) => {
    setPurchaseOrders((prev) => prev.map((po) => (po.id === poId ? { ...po, status: 'cancelled' as POStatus } : po)))
  }, [])

  const createLoan = useCallback<DataContextValue['createLoan']>((labId, lines, dueDate, notes) => {
    const id = nextId('ln')
    const seq = loans.length + 1
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
  }, [loans.length, applyQtyDelta, addMovement])

  const returnLoanLines = useCallback<DataContextValue['returnLoanLines']>((loanId, returns) => {
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
    const id = nextId('sal')
    const seq = sales.length + 1
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
  }, [sales.length, applyQtyDelta, addMovement])

  const addPatient = useCallback<DataContextValue['addPatient']>((input) => {
    const id = nextId('pat')
    const patient: Patient = { ...input, id, patientCode: `PT-${pad(1000 + patients.length + 1, 5)}`, createdAt: new Date().toISOString() }
    setPatients((prev) => [patient, ...prev])
    return patient
  }, [patients.length])

  const addCase = useCallback<DataContextValue['addCase']>((input) => {
    const id = nextId('cse')
    const year = new Date().getFullYear()
    const yearCases = cases.filter((c) => c.caseId.includes(`-${year}-`)).length
    const caseRecord: Case = { ...input, id, caseId: `IDC-${year}-${pad(yearCases + 1, 5)}`, createdAt: new Date().toISOString(), implants: input.implants ?? [] }
    setCases((prev) => [caseRecord, ...prev])
    return caseRecord
  }, [cases])

  const addLab = useCallback<DataContextValue['addLab']>((input) => {
    const id = nextId('lab')
    const lab: Lab = { ...input, id, createdAt: new Date().toISOString() }
    setLabs((prev) => [lab, ...prev])
    return lab
  }, [])

  const addVendor = useCallback<DataContextValue['addVendor']>((input) => {
    const id = nextId('vnd')
    const vendor: Vendor = { ...input, id, totalOrders: 0, onTimeRate: 1, createdAt: new Date().toISOString() }
    setVendors((prev) => [vendor, ...prev])
    return vendor
  }, [])

  const addUser = useCallback<DataContextValue['addUser']>((input) => {
    const id = nextId('usr')
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
      receivePurchaseOrder,
      cancelPurchaseOrder,
      createLoan,
      returnLoanLines,
      createSale,
      addPatient,
      addCase,
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
      receivePurchaseOrder,
      cancelPurchaseOrder,
      createLoan,
      returnLoanLines,
      createSale,
      addPatient,
      addCase,
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
