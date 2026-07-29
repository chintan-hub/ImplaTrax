import { useMemo, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { Search, Boxes, PackageCheck, AlertTriangle, ArrowDownToLine, ArrowUpFromLine, HandCoins, Undo2, XCircle, Stethoscope } from 'lucide-react'
import { PageHeader } from '@/components/shared/PageHeader'
import { StickyToolbar } from '@/components/shared/StickyToolbar'
import { EmptyState } from '@/components/shared/EmptyState'
import { StatCard } from '@/components/shared/StatCard'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetBody } from '@/components/ui/sheet'
import { TermHint } from '@/components/ui/help-tooltip'
import { useData } from '@/store/DataContext'
import { summarizeLots, type LotSummary, type BatchEvent } from '@/lib/batches'
import { formatDate, formatDateTime } from '@/lib/utils'
import { PAGE_INTROS, EMPTY_STATES } from '@/content/helpText'

const EVENT_ICON: Record<BatchEvent['kind'], typeof ArrowDownToLine> = {
  inbound: ArrowDownToLine,
  outbound: ArrowUpFromLine,
  adjustment: ArrowUpFromLine,
  sale: ArrowUpFromLine,
  'loan-out': HandCoins,
  'loan-return': Undo2,
  lost: XCircle,
  'case-usage': Stethoscope,
}

const EXPIRY_WARNING_DAYS = 90

export function BatchesPage() {
  const { products, batches, movements, cases, purchaseOrders, vendors, loans, labs, sales, patients, clinicSettings } = useData()
  const [search, setSearch] = useState('')
  const [productFilter, setProductFilter] = useState('all')
  const [selectedLot, setSelectedLot] = useState<LotSummary | null>(null)

  const batchTrackedProducts = useMemo(() => products.filter((p) => p.batchTracked), [products])
  const productById = useMemo(() => new Map(products.map((p) => [p.id, p])), [products])

  const lots = useMemo(() => summarizeLots(batches, movements, cases), [batches, movements, cases])

  const stats = useMemo(() => {
    const onHand = lots.reduce((s, l) => s + Math.max(0, l.remaining), 0)
    const soon = new Date(Date.now() + EXPIRY_WARNING_DAYS * 86400000).getTime()
    const expiringSoon = lots.filter((l) => l.expiryDate && l.remaining > 0 && new Date(l.expiryDate).getTime() <= soon).length
    return { totalLots: lots.length, onHand, expiringSoon }
  }, [lots])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return lots.filter((l) => {
      if (productFilter !== 'all' && l.productId !== productFilter) return false
      if (q) {
        const product = productById.get(l.productId)
        const hay = `${product?.name ?? ''} ${l.lotNumber}`.toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })
  }, [lots, search, productFilter, productById])

  // Resolves a raw event into what actually happened, in plain language a
  // first-time user doesn't need dental-software background to follow —
  // this is where the "life story" (Supplier -> PO -> Receiving -> Shelf ->
  // Loan -> Return -> Sale/Case -> Patient) actually gets woven together.
  const describeEvent = (e: BatchEvent): { title: string; detail: string } => {
    switch (e.kind) {
      case 'inbound': {
        const po = e.reference ? purchaseOrders.find((p) => p.poNumber === e.reference) : undefined
        const vendor = po ? vendors.find((v) => v.id === po.vendorId) : undefined
        return {
          title: `Received — ${e.quantity} unit(s)`,
          detail: vendor ? `From ${vendor.name}, via Purchase Order ${e.reference}` : `Purchase Order ${e.reference ?? 'unknown'}`,
        }
      }
      case 'loan-out': {
        const loan = e.reference ? loans.find((l) => l.loanNumber === e.reference) : undefined
        const lab = loan ? labs.find((l) => l.id === loan.labId) : undefined
        return { title: `Loaned out — ${Math.abs(e.quantity)} unit(s)`, detail: lab ? `To ${lab.name}, Loan ${e.reference}` : `Loan ${e.reference ?? 'unknown'}` }
      }
      case 'loan-return': {
        const loan = e.reference ? loans.find((l) => l.loanNumber === e.reference) : undefined
        const lab = loan ? labs.find((l) => l.id === loan.labId) : undefined
        return { title: `Returned by lab — ${e.quantity} unit(s)`, detail: lab ? `From ${lab.name}, Loan ${e.reference}` : `Loan ${e.reference ?? 'unknown'}` }
      }
      case 'lost': {
        const loan = e.reference ? loans.find((l) => l.loanNumber === e.reference) : undefined
        const lab = loan ? labs.find((l) => l.id === loan.labId) : undefined
        return { title: `Lost — ${Math.abs(e.quantity)} unit(s)`, detail: lab ? `While on loan to ${lab.name}, Loan ${e.reference}` : `Loan ${e.reference ?? 'unknown'}` }
      }
      case 'sale': {
        const sale = e.reference ? sales.find((s) => s.saleNumber === e.reference) : undefined
        const patient = sale?.patientId ? patients.find((p) => p.id === sale.patientId) : undefined
        return {
          title: `Sold — ${Math.abs(e.quantity)} unit(s)`,
          detail: patient ? `Patient ${patient.firstName} ${patient.lastName}, Sale ${e.reference}` : `Sale ${e.reference ?? 'unknown'} (direct sale, no patient)`,
        }
      }
      case 'case-usage': {
        const caseRecord = e.reference ? cases.find((c) => c.caseId === e.reference) : undefined
        const patient = caseRecord ? patients.find((p) => p.id === caseRecord.patientId) : undefined
        return {
          title: `Used in a patient case — ${e.quantity} unit(s)`,
          detail: patient ? `Patient ${patient.firstName} ${patient.lastName}, Case ${e.reference} — not deducted from stock (see note below)` : `Case ${e.reference ?? 'unknown'} — not deducted from stock (see note below)`,
        }
      }
      default:
        return { title: 'Stock movement', detail: e.reference ?? '' }
    }
  }

  // Batch/Lot Tracking is an application-wide setting (PROJECT.md §3) — this
  // page must be unreachable, even via a typed URL, whenever it's off. Checked
  // after every hook above so hook call order never changes between renders.
  if (!clinicSettings.batchLotTrackingEnabled) {
    return <Navigate to="/" replace />
  }

  return (
    <div>
      <PageHeader title={PAGE_INTROS.batches.title} description={PAGE_INTROS.batches.description} helpTerm="batchLot" />

      {batchTrackedProducts.length === 0 ? (
        <EmptyState
          icon={Boxes}
          title="No Batch-Tracked Products Yet"
          description="Batch/lot tracking is an optional setting on each product. Turn it on for a product (e.g. implant fixtures or graft material) to start seeing its lots here."
        />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 mb-6">
            <StatCard label="Lots Tracked" value={String(stats.totalLots)} icon={Boxes} helpTerm="batchLot" />
            <StatCard label="Units Currently On Hand" value={String(stats.onHand)} icon={PackageCheck} tone="success" helpTerm="remainingQuantity" />
            <StatCard label="Expiring Within 90 Days" value={String(stats.expiringSoon)} icon={AlertTriangle} tone={stats.expiringSoon > 0 ? 'warning' : 'default'} />
          </div>

          <p className="mb-4 text-sm text-muted-foreground">
            Each row below is one delivery of a component, identified by its lot number. Click a row to see its full journey — where it came from, everywhere it went, and how much is left. Only components with batch/lot tracking turned on appear here.
          </p>

          <StickyToolbar>
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Search product or lot number..." className="pl-8" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <Select value={productFilter} onValueChange={setProductFilter}>
              <SelectTrigger className="w-full sm:w-56"><SelectValue placeholder="Product" /></SelectTrigger>
              <SelectContent className="max-h-72">
                <SelectItem value="all">All batch-tracked products</SelectItem>
                {batchTrackedProducts.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </StickyToolbar>

          {filtered.length === 0 ? (
            <EmptyState icon={Search} title={EMPTY_STATES.batches.title} description={EMPTY_STATES.batches.description} />
          ) : (
            <div className="rounded-xl border border-border bg-card">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead>Lot Number</TableHead>
                    <TableHead className="text-right">Received</TableHead>
                    <TableHead className="text-right">
                      <span className="inline-flex items-center gap-1 justify-end">
                        Remaining <TermHint term="remainingQuantity" iconOnly />
                      </span>
                    </TableHead>
                    <TableHead>Expiry</TableHead>
                    <TableHead>Origin</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((lot) => {
                    const product = productById.get(lot.productId)
                    const expiringSoon = lot.expiryDate && lot.remaining > 0 && new Date(lot.expiryDate).getTime() <= Date.now() + EXPIRY_WARNING_DAYS * 86400000
                    return (
                      <TableRow key={`${lot.productId}::${lot.lotNumber}`} className="cursor-pointer" onClick={() => setSelectedLot(lot)}>
                        <TableCell>
                          <p className="font-medium">{product?.name ?? 'Unknown product'}</p>
                          <p className="text-xs text-muted-foreground">{product?.sku}</p>
                        </TableCell>
                        <TableCell className="font-mono text-sm">{lot.lotNumber}</TableCell>
                        <TableCell className="text-right tabular-nums">{lot.totalReceived}</TableCell>
                        <TableCell className="text-right tabular-nums">
                          <span className={lot.remaining < 0 ? 'text-danger-600 font-medium' : undefined}>{lot.remaining}</span>
                        </TableCell>
                        <TableCell>
                          {lot.expiryDate ? (
                            <Badge variant={expiringSoon ? 'warning' : 'secondary'}>{formatDate(lot.expiryDate)}</Badge>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {lot.hasReceivingRecord ? (
                            <Badge variant="success">Received</Badge>
                          ) : (
                            <Badge variant="warning">No receiving record</Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </>
      )}

      <Sheet open={!!selectedLot} onOpenChange={(v) => !v && setSelectedLot(null)}>
        <SheetContent className="sm:max-w-lg">
          {selectedLot && (
            <>
              <SheetHeader>
                <SheetTitle>Lot {selectedLot.lotNumber}</SheetTitle>
                <SheetDescription>{productById.get(selectedLot.productId)?.name ?? 'Unknown product'}</SheetDescription>
              </SheetHeader>
              <SheetBody className="space-y-6">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-muted-foreground">Total received</p>
                    <p className="font-medium tabular-nums">{selectedLot.totalReceived}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Remaining on shelf</p>
                    <p className={`font-medium tabular-nums ${selectedLot.remaining < 0 ? 'text-danger-600' : ''}`}>{selectedLot.remaining}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Expiry</p>
                    <p className="font-medium">{selectedLot.expiryDate ? formatDate(selectedLot.expiryDate) : 'Not recorded'}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Origin</p>
                    <p className="font-medium">{selectedLot.hasReceivingRecord ? 'Received through the system' : 'No receiving record found'}</p>
                  </div>
                </div>

                {!selectedLot.hasReceivingRecord && (
                  <p className="rounded-lg bg-warning/10 p-3 text-xs text-warning-700 dark:text-warning-500">
                    This lot number was typed in when a component was used or sold, but was never received through a Purchase Order in this system — so there's no record of how many units originally arrived. Its "remaining" figure only reflects what's happened since it was first mentioned.
                  </p>
                )}

                <div>
                  <p className="mb-3 text-sm font-medium">Full journey</p>
                  <div className="relative space-y-6 pl-6 before:absolute before:left-[7px] before:top-1 before:h-[calc(100%-8px)] before:w-px before:bg-border">
                    {selectedLot.events.map((e) => {
                      const { title, detail } = describeEvent(e)
                      const Icon = EVENT_ICON[e.kind]
                      return (
                        <div key={e.id} className="relative">
                          <span className="absolute -left-6 top-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-primary ring-4 ring-primary/15">
                            <Icon className="h-2 w-2 text-primary-foreground" />
                          </span>
                          <p className="text-sm font-medium">{title}</p>
                          <p className="mt-0.5 text-sm text-muted-foreground">{detail}</p>
                          <p className="mt-1 text-xs text-muted-foreground">{formatDateTime(e.date)}</p>
                        </div>
                      )
                    })}
                  </div>
                </div>

                <p className="text-xs text-muted-foreground">
                  Patient-case usage is shown above for traceability, but doesn't currently reduce the remaining count — recording a component against a case doesn't yet deduct stock in this version of ImplantDesk (only a recorded Sale does).
                </p>
              </SheetBody>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  )
}
