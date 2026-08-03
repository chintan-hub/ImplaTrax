import { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react'
import type {
  Product,
  ProductBatch,
  InventoryMovement,
  PurchaseOrder,
  Vendor,
  Doctor,
  Patient,
  Case,
  CaseStatus,
  CaseImplantUsage,
  Lab,
  Sale,
  SaleLine,
  Loan,
  ClinicSettings,
} from '@/types'
import * as mock from '@/mocks'
import { useAuth } from '@/features/auth/AuthContext'
import { canSubmitPO, canReceivePO, canCancelPO } from '@/lib/poWorkflow'
import { canAdvanceCaseStatus } from '@/lib/caseWorkflow'
import { canReturnLoan } from '@/lib/loanWorkflow'
import {
  fetchProducts, insertProduct, bulkInsertProducts, updateProductRow, fetchProductBatches,
  fetchMovements, adjustStockRpc,
  fetchVendors, insertVendor, updateVendorRow,
  fetchPurchaseOrders, createPurchaseOrderRpc, submitPurchaseOrderRpc, cancelPurchaseOrderRpc, attachPoPhotoRpc, receivePurchaseOrderRpc,
  fetchDoctors, insertDoctor, updateDoctorActive,
  fetchPatients, insertPatient, updatePatientRow,
  fetchCases, insertCase, advanceCaseStatusRow, addImplantToCaseRpc,
  fetchLabs, insertLab, updateLabRow,
  fetchSales, createSaleRpc, voidSaleRpc,
  fetchLoans, createLoanRpc, returnLoanLinesRpc,
  fetchClinicSettings, updateClinicSettingsRow,
  nextSaleNumber, nextLoanNumber, nextCaseNumber, nextPoNumber,
  wipeWorkspaceDataRpc,
} from '@/lib/supabase/queries'

/**
 * Business-rule validation lives here, in the action functions, not just in
 * the calling UI dialogs — every RPC these actions call re-validates the
 * same rules server-side (the actual source of truth now), so these checks
 * are a fast first line of defense against an obviously-invalid submission,
 * not the last one. Convention: a violated rule throws a plain Error with a
 * user-facing message.
 */
class BusinessRuleError extends Error {}

/**
 * Rejects a Sale/Loan submission that would take any product below zero on
 * hand — quantities are summed per product across every line first, since a
 * single submission can list the same product on more than one line.
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
  clinicSettings: ClinicSettings
  batches: ProductBatch[]
  doctors: Doctor[]
  /** True while the initial per-workspace fetch is in flight — every list above is empty until this settles. */
  loading: boolean

  adjustStock: (productId: string, delta: number, reason: string, note?: string) => Promise<void>
  addProduct: (input: Omit<Product, 'id' | 'sku' | 'barcode' | 'qrPayload' | 'createdAt' | 'updatedAt'>) => Promise<Product>
  updateProduct: (id: string, patch: Partial<Product>) => Promise<void>
  importProducts: (inputs: Omit<Product, 'id' | 'sku' | 'barcode' | 'qrPayload' | 'createdAt' | 'updatedAt'>[]) => Promise<Product[]>

  createPurchaseOrder: (vendorId: string, lines: { productId: string; quantityOrdered: number; unitCost: number }[], eta: string, notes?: string) => Promise<PurchaseOrder>
  submitPurchaseOrder: (poId: string) => Promise<void>
  /**
   * `photoUrls` is mandatory whenever this receipt is partial — i.e. any
   * line's receipt quantity comes in short of what's currently outstanding
   * for it, whether under-received or skipped entirely. The receive_purchase_order
   * RPC (migration 0013) enforces this server-side; the same check here just
   * gives instant feedback before the round trip.
   */
  receivePurchaseOrder: (poId: string, receipts: { lineId: string; quantityReceived: number; lotNumber?: string; expiryDate?: string }[], photoUrls?: string[]) => Promise<void>
  cancelPurchaseOrder: (poId: string) => Promise<void>
  attachPhotoToOrder: (poId: string, photoDataUrl: string | undefined) => Promise<void>

  createLoan: (labId: string, lines: { productId: string; quantityLoaned: number; batchLot?: string }[], dueDate?: string, notes?: string, photoUrls?: string[]) => Promise<Loan>
  returnLoanLines: (loanId: string, returns: { lineId: string; quantityReturned: number; quantityLost: number; lostReason?: string }[], photoUrls?: string[]) => Promise<void>

  createSale: (lines: SaleLine[], patientId: string, caseId?: string, photoUrls?: string[]) => Promise<Sale>
  voidSale: (saleId: string, reason: string) => Promise<void>

  addPatient: (input: Omit<Patient, 'id' | 'patientCode' | 'createdAt'>) => Promise<Patient>
  updatePatient: (id: string, patch: Partial<Patient>) => Promise<void>
  addCase: (input: Omit<Case, 'id' | 'caseId' | 'createdAt' | 'implants' | 'history'> & { implants?: Case['implants'] }) => Promise<Case>
  advanceCaseStatus: (caseId: string, status: CaseStatus) => Promise<void>
  addImplantToCase: (caseId: string, usage: CaseImplantUsage) => Promise<void>
  addLab: (input: Omit<Lab, 'id' | 'createdAt'>) => Promise<Lab>
  updateLab: (id: string, patch: Partial<Lab>) => Promise<void>
  addVendor: (input: Omit<Vendor, 'id' | 'createdAt' | 'totalOrders' | 'onTimeRate'>) => Promise<Vendor>
  updateVendor: (id: string, patch: Partial<Vendor>) => Promise<void>
  updateClinicSettings: (patch: Partial<ClinicSettings>) => Promise<void>
  addDoctor: (input: { name: string; active?: boolean }) => Promise<Doctor>
  setDoctorActive: (id: string, active: boolean) => Promise<void>

  /** Settings > Danger Zone — permanently deletes every sale/patient/case/PO/loan/product/vendor/lab/doctor row for the active workspace (server-enforced to workspace managers only). The workspace itself, its members, and its settings are untouched. */
  wipeWorkspaceData: () => Promise<void>
}

const DataContext = createContext<DataContextValue | null>(null)

export function DataProvider({ children }: { children: React.ReactNode }) {
  const { currentWorkspace, currentMember } = useAuth()
  const workspaceId = currentWorkspace?.id ?? null
  const actorName = currentMember?.name ?? 'System'

  const [products, setProducts] = useState<Product[]>([])
  const [movements, setMovements] = useState<InventoryMovement[]>([])
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([])
  const [vendors, setVendors] = useState<Vendor[]>([])
  const [patients, setPatients] = useState<Patient[]>([])
  const [cases, setCases] = useState<Case[]>([])
  const [labs, setLabs] = useState<Lab[]>([])
  const [sales, setSales] = useState<Sale[]>([])
  const [loans, setLoans] = useState<Loan[]>([])
  const [clinicSettings, setClinicSettings] = useState<ClinicSettings>(mock.emptyClinicSettings)
  const [batches, setBatches] = useState<ProductBatch[]>([])
  const [doctors, setDoctors] = useState<Doctor[]>([])
  const [loading, setLoading] = useState(true)

  const refetchProducts = useCallback(async () => {
    if (!workspaceId) return [] as Product[]
    const rows = await fetchProducts(workspaceId)
    setProducts(rows)
    return rows
  }, [workspaceId])
  const refetchMovements = useCallback(async () => {
    if (!workspaceId) return [] as InventoryMovement[]
    const rows = await fetchMovements(workspaceId)
    setMovements(rows)
    return rows
  }, [workspaceId])
  const refetchPurchaseOrders = useCallback(async () => {
    if (!workspaceId) return [] as PurchaseOrder[]
    const rows = await fetchPurchaseOrders(workspaceId)
    setPurchaseOrders(rows)
    return rows
  }, [workspaceId])
  const refetchVendors = useCallback(async () => {
    if (!workspaceId) return [] as Vendor[]
    const rows = await fetchVendors(workspaceId)
    setVendors(rows)
    return rows
  }, [workspaceId])
  const refetchPatients = useCallback(async () => {
    if (!workspaceId) return [] as Patient[]
    const rows = await fetchPatients(workspaceId)
    setPatients(rows)
    return rows
  }, [workspaceId])
  const refetchCases = useCallback(async () => {
    if (!workspaceId) return [] as Case[]
    const rows = await fetchCases(workspaceId)
    setCases(rows)
    return rows
  }, [workspaceId])
  const refetchLabs = useCallback(async () => {
    if (!workspaceId) return [] as Lab[]
    const rows = await fetchLabs(workspaceId)
    setLabs(rows)
    return rows
  }, [workspaceId])
  const refetchSales = useCallback(async () => {
    if (!workspaceId) return [] as Sale[]
    const rows = await fetchSales(workspaceId)
    setSales(rows)
    return rows
  }, [workspaceId])
  const refetchLoans = useCallback(async () => {
    if (!workspaceId) return [] as Loan[]
    const rows = await fetchLoans(workspaceId)
    setLoans(rows)
    return rows
  }, [workspaceId])
  const refetchClinicSettings = useCallback(async () => {
    if (!workspaceId) return mock.emptyClinicSettings
    const row = await fetchClinicSettings(workspaceId)
    setClinicSettings(row)
    return row
  }, [workspaceId])
  const refetchBatches = useCallback(async () => {
    if (!workspaceId) return [] as ProductBatch[]
    const rows = await fetchProductBatches(workspaceId)
    setBatches(rows)
    return rows
  }, [workspaceId])
  const refetchDoctors = useCallback(async () => {
    if (!workspaceId) return [] as Doctor[]
    const rows = await fetchDoctors(workspaceId)
    setDoctors(rows)
    return rows
  }, [workspaceId])

  // Loads every workspace-scoped table once per active workspace — there is
  // no backend push/subscription yet, so every mutating action below
  // refetches whichever slices it touched instead of relying on this effect
  // to notice a change.
  useEffect(() => {
    let cancelled = false
    if (!workspaceId) {
      setProducts([])
      setMovements([])
      setPurchaseOrders([])
      setVendors([])
      setPatients([])
      setCases([])
      setLabs([])
      setSales([])
      setLoans([])
      setClinicSettings(mock.emptyClinicSettings)
      setBatches([])
      setDoctors([])
      setLoading(false)
      return
    }
    setLoading(true)
    Promise.all([
      refetchProducts(), refetchMovements(), refetchPurchaseOrders(), refetchVendors(),
      refetchPatients(), refetchCases(), refetchLabs(), refetchSales(), refetchLoans(),
      refetchClinicSettings(), refetchBatches(), refetchDoctors(),
    ]).finally(() => {
      if (!cancelled) setLoading(false)
    })
    return () => {
      cancelled = true
    }
    // Every refetch* callback already depends on workspaceId — including
    // them here would just re-run this identical fetch-all on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceId])

  const requireWorkspace = useCallback(() => {
    if (!workspaceId) throw new BusinessRuleError('No active workspace.')
    return workspaceId
  }, [workspaceId])

  const adjustStock = useCallback(
    async (productId: string, delta: number, reason: string, note?: string) => {
      if (!reason.trim()) throw new BusinessRuleError('A reason is required for manual stock adjustments.')
      await adjustStockRpc(productId, delta, reason, note)
      await Promise.all([refetchProducts(), refetchMovements()])
    },
    [refetchProducts, refetchMovements],
  )

  const addProduct = useCallback(
    async (input: Omit<Product, 'id' | 'sku' | 'barcode' | 'qrPayload' | 'createdAt' | 'updatedAt'>) => {
      const wsId = requireWorkspace()
      const product = await insertProduct(wsId, input)
      if (input.quantityOnHand > 0) {
        await adjustStockRpc(product.id, input.quantityOnHand, 'Initial stock on product creation')
      }
      const [rows] = await Promise.all([refetchProducts(), refetchMovements()])
      return rows.find((p) => p.id === product.id) ?? product
    },
    [requireWorkspace, refetchProducts, refetchMovements],
  )

  const updateProduct = useCallback(
    async (id: string, patch: Partial<Product>) => {
      await updateProductRow(id, patch)
      await refetchProducts()
    },
    [refetchProducts],
  )

  /**
   * Bulk-import counterpart to addProduct — same SKU/barcode/vendor-match
   * formula (see queries.ts's buildProductRow), applied to every row in a
   * single insert so the whole batch commits atomically. The caller
   * (ProductImportDialog) has already validated every row and only ever
   * passes the ones with zero errors — this function does not re-validate.
   */
  const importProducts = useCallback(
    async (inputs: Omit<Product, 'id' | 'sku' | 'barcode' | 'qrPayload' | 'createdAt' | 'updatedAt'>[]) => {
      const wsId = requireWorkspace()
      const resolved = inputs.map((input) => {
        const vendor = vendors.find((v) => v.manufacturers.includes(input.manufacturer)) ?? vendors[0]
        return { ...input, vendorId: vendor?.id ?? input.vendorId }
      })
      const created = await bulkInsertProducts(wsId, resolved)
      await Promise.all(
        created.map((product, i) => (resolved[i].quantityOnHand > 0 ? adjustStockRpc(product.id, resolved[i].quantityOnHand, 'Initial stock on bulk import') : Promise.resolve())),
      )
      const [rows] = await Promise.all([refetchProducts(), refetchMovements()])
      const createdIds = new Set(created.map((p) => p.id))
      return rows.filter((p) => createdIds.has(p.id))
    },
    [vendors, requireWorkspace, refetchProducts, refetchMovements],
  )

  const createPurchaseOrder = useCallback(
    async (vendorId: string, lines: { productId: string; quantityOrdered: number; unitCost: number }[], eta: string, notes?: string) => {
      const wsId = requireWorkspace()
      const poNumber = await nextPoNumber(wsId)
      const poId = await createPurchaseOrderRpc(wsId, poNumber, vendorId, lines, eta, notes)
      const rows = await refetchPurchaseOrders()
      const po = rows.find((p) => p.id === poId)
      if (!po) throw new Error('Purchase order created but could not be reloaded.')
      return po
    },
    [requireWorkspace, refetchPurchaseOrders],
  )

  const submitPurchaseOrder = useCallback(
    async (poId: string) => {
      const po = purchaseOrders.find((p) => p.id === poId)
      if (!po || !canSubmitPO(po)) throw new BusinessRuleError('Only a draft purchase order can be submitted.')
      await submitPurchaseOrderRpc(poId)
      await refetchPurchaseOrders()
    },
    [purchaseOrders, refetchPurchaseOrders],
  )

  const receivePurchaseOrder = useCallback(
    async (poId: string, receipts: { lineId: string; quantityReceived: number; lotNumber?: string; expiryDate?: string }[], photoUrls?: string[]) => {
      if (!receipts.some((r) => r.quantityReceived > 0)) {
        throw new BusinessRuleError('Enter a quantity to receive for at least one line.')
      }
      const po = purchaseOrders.find((p) => p.id === poId)
      if (!po || !canReceivePO(po)) throw new BusinessRuleError('This purchase order cannot be received in its current status.')

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

      const isPartialReceive = po.lines.some((line) => {
        const remainingQty = line.quantityOrdered - line.quantityReceived
        const receivingQty = receipts.find((r) => r.lineId === line.id)?.quantityReceived ?? 0
        return receivingQty < remainingQty
      })
      if (isPartialReceive && (!photoUrls || photoUrls.length === 0)) {
        throw new BusinessRuleError('Please attach at least one photo of the delivery slip or package to document this partial receipt.')
      }

      await receivePurchaseOrderRpc(poId, receipts, photoUrls)
      await Promise.all([refetchPurchaseOrders(), refetchProducts(), refetchMovements(), refetchBatches()])
    },
    [purchaseOrders, products, clinicSettings, refetchPurchaseOrders, refetchProducts, refetchMovements, refetchBatches],
  )

  const cancelPurchaseOrder = useCallback(
    async (poId: string) => {
      const po = purchaseOrders.find((p) => p.id === poId)
      if (!po || !canCancelPO(po)) throw new BusinessRuleError('This purchase order can no longer be cancelled.')
      await cancelPurchaseOrderRpc(poId)
      await refetchPurchaseOrders()
    },
    [purchaseOrders, refetchPurchaseOrders],
  )

  const attachPhotoToOrder = useCallback(
    async (poId: string, photoDataUrl: string | undefined) => {
      await attachPoPhotoRpc(poId, photoDataUrl)
      await refetchPurchaseOrders()
    },
    [refetchPurchaseOrders],
  )

  const createLoan = useCallback(
    async (labId: string, lines: { productId: string; quantityLoaned: number; batchLot?: string }[], dueDate?: string, notes?: string, photoUrls?: string[]) => {
      const wsId = requireWorkspace()
      if (!labs.some((l) => l.id === labId)) throw new BusinessRuleError('Loans can only be issued to a lab.')
      if (lines.length === 0) throw new BusinessRuleError('A loan must include at least one product line.')
      assertStockAvailable(products, lines.map((l) => ({ productId: l.productId, quantity: l.quantityLoaned })))
      const loanNumber = await nextLoanNumber(wsId)
      const loanId = await createLoanRpc(wsId, loanNumber, labId, lines, dueDate, notes)
      const [rows] = await Promise.all([refetchLoans(), refetchProducts(), refetchMovements()])
      const loan = rows.find((l) => l.id === loanId)
      if (!loan) throw new Error('Loan created but could not be reloaded.')
      void photoUrls // photo evidence for loan issuance is not yet part of create_loan's RPC surface
      return loan
    },
    [labs, products, requireWorkspace, refetchLoans, refetchProducts, refetchMovements],
  )

  const returnLoanLines = useCallback(
    async (loanId: string, returns: { lineId: string; quantityReturned: number; quantityLost: number; lostReason?: string }[], photoUrls?: string[]) => {
      if (!returns.some((r) => r.quantityReturned > 0 || r.quantityLost > 0)) {
        throw new BusinessRuleError('Enter a returned or lost quantity for at least one item.')
      }
      if (returns.some((r) => r.quantityLost > 0 && !r.lostReason?.trim())) {
        throw new BusinessRuleError('A reason is required for any lost components.')
      }
      const loan = loans.find((l) => l.id === loanId)
      if (!loan || !canReturnLoan(loan)) throw new BusinessRuleError('This loan has already been closed and can no longer be returned against.')
      await returnLoanLinesRpc(loanId, returns)
      await Promise.all([refetchLoans(), refetchProducts(), refetchMovements()])
      void photoUrls // photo evidence for loan returns is not yet part of return_loan_lines's RPC surface
    },
    [loans, refetchLoans, refetchProducts, refetchMovements],
  )

  const createSale = useCallback(
    async (lines: SaleLine[], patientId: string, caseId?: string, photoUrls?: string[]) => {
      const wsId = requireWorkspace()
      if (!patientId || !patientId.trim()) throw new BusinessRuleError('A patient is required to record a sale.')
      if (lines.length === 0) throw new BusinessRuleError('A sale must include at least one product line.')
      assertStockAvailable(products, lines.map((l) => ({ productId: l.productId, quantity: l.quantity })))
      const saleNumber = await nextSaleNumber(wsId)
      const saleId = await createSaleRpc(wsId, saleNumber, lines, patientId, caseId)
      const [rows] = await Promise.all([refetchSales(), refetchProducts(), refetchMovements()])
      const sale = rows.find((s) => s.id === saleId)
      if (!sale) throw new Error('Sale created but could not be reloaded.')
      void photoUrls // photo evidence for direct sales is not yet part of create_sale's RPC surface
      return sale
    },
    [products, requireWorkspace, refetchSales, refetchProducts, refetchMovements],
  )

  const addPatient = useCallback(
    async (input: Omit<Patient, 'id' | 'patientCode' | 'createdAt'>) => {
      const wsId = requireWorkspace()
      const patient = await insertPatient(wsId, input)
      setPatients((prev) => [patient, ...prev])
      return patient
    },
    [requireWorkspace],
  )

  const updatePatient = useCallback(async (id: string, patch: Partial<Patient>) => {
    await updatePatientRow(id, patch)
    setPatients((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)))
  }, [])

  // The inverse of createSale: restores every line's quantity to stock and
  // records the sale as voided (never deleted — same append-only convention
  // as everything else here). A sale's `total` is left untouched so its
  // original record stays intact; callers must exclude voided sales from
  // revenue sums themselves (sales.filter(s => !s.voidedAt)).
  const voidSale = useCallback(
    async (saleId: string, reason: string) => {
      if (!reason.trim()) throw new BusinessRuleError('A reason is required to void a sale.')
      const sale = sales.find((s) => s.id === saleId)
      if (!sale) throw new BusinessRuleError('Sale not found.')
      if (sale.voidedAt) throw new BusinessRuleError('This sale has already been voided.')
      await voidSaleRpc(saleId, reason)
      await Promise.all([refetchSales(), refetchProducts(), refetchMovements(), sale.caseId ? refetchCases() : Promise.resolve()])
    },
    [sales, refetchSales, refetchProducts, refetchMovements, refetchCases],
  )

  const addCase = useCallback(
    async (input: Omit<Case, 'id' | 'caseId' | 'createdAt' | 'implants' | 'history'> & { implants?: Case['implants'] }) => {
      const wsId = requireWorkspace()
      const caseNumber = await nextCaseNumber(wsId)
      const caseRecord = await insertCase(wsId, caseNumber, input, actorName)
      setCases((prev) => [caseRecord, ...prev])
      return caseRecord
    },
    [requireWorkspace, actorName],
  )

  const advanceCaseStatus = useCallback(
    async (caseId: string, status: CaseStatus) => {
      const caseRecord = cases.find((c) => c.id === caseId)
      if (!caseRecord || !canAdvanceCaseStatus(caseRecord, status)) {
        throw new BusinessRuleError('This case cannot move to that status from its current status.')
      }
      await advanceCaseStatusRow(caseId, status, CASE_STATUS_EVENT_LABEL[status], actorName)
      await refetchCases()
    },
    [cases, actorName, refetchCases],
  )

  // Placing an implant is a real stock-affecting event, not just a case
  // note: add_implant_to_case (migration 0011) deducts inventory, records a
  // movement, and creates a Sale linked back to this case/patient all in one
  // transaction, so the case's implant list can never drift out of sync with
  // stock/sales the way two separate client-side writes could.
  const addImplantToCase = useCallback(
    async (caseId: string, usage: CaseImplantUsage) => {
      if (!usage.tooth.trim()) throw new BusinessRuleError('A tooth number is required.')
      if (usage.quantity <= 0) throw new BusinessRuleError('Quantity must be greater than zero.')
      const caseRecord = cases.find((c) => c.id === caseId)
      if (!caseRecord) throw new BusinessRuleError('Case not found.')
      const product = products.find((p) => p.id === usage.productId)
      if (!product) throw new BusinessRuleError('Product not found.')
      await addImplantToCaseRpc(caseId, usage.productId, usage.tooth, usage.quantity, product.unitPrice, usage.batchLot)
      await Promise.all([refetchCases(), refetchProducts(), refetchMovements(), refetchSales()])
    },
    [cases, products, refetchCases, refetchProducts, refetchMovements, refetchSales],
  )

  const addLab = useCallback(
    async (input: Omit<Lab, 'id' | 'createdAt'>) => {
      const wsId = requireWorkspace()
      const lab = await insertLab(wsId, input)
      setLabs((prev) => [lab, ...prev])
      return lab
    },
    [requireWorkspace],
  )

  const updateLab = useCallback(async (id: string, patch: Partial<Lab>) => {
    await updateLabRow(id, patch)
    setLabs((prev) => prev.map((l) => (l.id === id ? { ...l, ...patch } : l)))
  }, [])

  const addVendor = useCallback(
    async (input: Omit<Vendor, 'id' | 'createdAt' | 'totalOrders' | 'onTimeRate'>) => {
      const wsId = requireWorkspace()
      const vendor = await insertVendor(wsId, input)
      setVendors((prev) => [vendor, ...prev])
      return vendor
    },
    [requireWorkspace],
  )

  const updateVendor = useCallback(async (id: string, patch: Partial<Vendor>) => {
    await updateVendorRow(id, patch)
    setVendors((prev) => prev.map((v) => (v.id === id ? { ...v, ...patch } : v)))
  }, [])

  const updateClinicSettings = useCallback(
    async (patch: Partial<ClinicSettings>) => {
      const wsId = requireWorkspace()
      await updateClinicSettingsRow(wsId, patch)
      setClinicSettings((prev) => ({ ...prev, ...patch }))
    },
    [requireWorkspace],
  )

  const addDoctor = useCallback(
    async (input: { name: string; active?: boolean }) => {
      const wsId = requireWorkspace()
      const doctor = await insertDoctor(wsId, input.name, input.active ?? true)
      setDoctors((prev) => [doctor, ...prev])
      return doctor
    },
    [requireWorkspace],
  )

  // Doctor is stored as a plain "Dr. <name>" display string on Case/Patient
  // (no foreign key — PROJECT.md §3), so archiving never orphans a record:
  // existing cases/patients keep the name exactly as it was. Archiving only
  // removes the doctor from DoctorCombobox's picker for new selections.
  const setDoctorActive = useCallback(async (id: string, active: boolean) => {
    await updateDoctorActive(id, active)
    setDoctors((prev) => prev.map((d) => (d.id === id ? { ...d, active } : d)))
  }, [])

  const wipeWorkspaceData = useCallback(async () => {
    const wsId = requireWorkspace()
    await wipeWorkspaceDataRpc(wsId)
    await Promise.all([
      refetchProducts(), refetchMovements(), refetchPurchaseOrders(), refetchVendors(),
      refetchPatients(), refetchCases(), refetchLabs(), refetchSales(), refetchLoans(), refetchBatches(), refetchDoctors(),
    ])
  }, [requireWorkspace, refetchProducts, refetchMovements, refetchPurchaseOrders, refetchVendors, refetchPatients, refetchCases, refetchLabs, refetchSales, refetchLoans, refetchBatches, refetchDoctors])

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
      clinicSettings,
      batches,
      doctors,
      loading,
      adjustStock,
      addProduct,
      updateProduct,
      importProducts,
      createPurchaseOrder,
      submitPurchaseOrder,
      receivePurchaseOrder,
      cancelPurchaseOrder,
      attachPhotoToOrder,
      createLoan,
      returnLoanLines,
      createSale,
      voidSale,
      addPatient,
      updatePatient,
      addCase,
      advanceCaseStatus,
      addImplantToCase,
      addLab,
      updateLab,
      addVendor,
      updateVendor,
      updateClinicSettings,
      addDoctor,
      setDoctorActive,
      wipeWorkspaceData,
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
      clinicSettings,
      batches,
      doctors,
      loading,
      adjustStock,
      addProduct,
      updateProduct,
      importProducts,
      createPurchaseOrder,
      submitPurchaseOrder,
      receivePurchaseOrder,
      cancelPurchaseOrder,
      attachPhotoToOrder,
      createLoan,
      returnLoanLines,
      createSale,
      voidSale,
      addPatient,
      updatePatient,
      addCase,
      advanceCaseStatus,
      addImplantToCase,
      addLab,
      updateLab,
      addVendor,
      updateVendor,
      updateClinicSettings,
      addDoctor,
      setDoctorActive,
      wipeWorkspaceData,
    ],
  )

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>
}

export function useData() {
  const ctx = useContext(DataContext)
  if (!ctx) throw new Error('useData must be used within DataProvider')
  return ctx
}
