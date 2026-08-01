import { useMemo, useState } from 'react'
import { ArrowDownToLine, ArrowUpFromLine, SlidersHorizontal, Plus, Search, Download } from 'lucide-react'
import { StickyActionHeader } from '@/components/shared/StickyActionHeader'
import { StatCard } from '@/components/shared/StatCard'
import { EmptyState } from '@/components/shared/EmptyState'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Combobox } from '@/components/ui/combobox'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { AdjustmentDialog } from '@/components/inventory/AdjustmentDialog'
import { useData } from '@/store/DataContext'
import { patientFullName } from '@/mocks/patients'
import { formatDateTime } from '@/lib/utils'
import { exportToCsv } from '@/lib/documents/csv'
import { PAGE_INTROS, EMPTY_STATES } from '@/content/helpText'
import { productComboboxOptions } from '@/lib/productOptions'
import type { MovementType } from '@/types'

const TYPE_LABEL: Record<MovementType, string> = {
  inbound: 'Inbound',
  outbound: 'Outbound',
  adjustment: 'Adjustment',
  'loan-out': 'Loan Out',
  'loan-return': 'Loan Return',
  sale: 'Sale',
  lost: 'Lost',
}

const TYPE_VARIANT: Record<MovementType, 'success' | 'danger' | 'warning' | 'accent' | 'secondary'> = {
  inbound: 'success',
  outbound: 'danger',
  adjustment: 'warning',
  'loan-out': 'accent',
  'loan-return': 'accent',
  sale: 'secondary',
  lost: 'danger',
}

// Real MovementType producers only — 'outbound' has zero producers anywhere
// in DataContext (a dead enum member), so it's excluded from this filter to
// avoid offering a filter value that can never match anything.
const FILTERABLE_TYPES: MovementType[] = ['inbound', 'adjustment', 'loan-out', 'loan-return', 'sale', 'lost']

export function InventoryPage() {
  const { movements, products, users, vendors, labs, patients, doctors, clinicSettings } = useData()
  const [typeFilter, setTypeFilter] = useState('all')
  const [productFilter, setProductFilter] = useState('all')
  const [doctorFilter, setDoctorFilter] = useState('all')
  const [patientFilter, setPatientFilter] = useState('all')
  const [vendorFilter, setVendorFilter] = useState('all')
  const [labFilter, setLabFilter] = useState('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [search, setSearch] = useState('')
  const [adjustOpen, setAdjustOpen] = useState(false)

  const productById = useMemo(() => new Map(products.map((p) => [p.id, p])), [products])
  const userById = useMemo(() => new Map(users.map((u) => [u.id, u])), [users])
  const vendorById = useMemo(() => new Map(vendors.map((v) => [v.id, v])), [vendors])
  const labById = useMemo(() => new Map(labs.map((l) => [l.id, l])), [labs])
  const patientById = useMemo(() => new Map(patients.map((p) => [p.id, p])), [patients])

  const stats = useMemo(() => {
    const inbound = movements.filter((m) => m.quantity > 0).reduce((s, m) => s + m.quantity, 0)
    const outbound = movements.filter((m) => m.quantity < 0).reduce((s, m) => s + Math.abs(m.quantity), 0)
    const adjustments = movements.filter((m) => m.type === 'adjustment').length
    return { inbound, outbound, adjustments, total: movements.length }
  }, [movements])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    const from = dateFrom ? new Date(dateFrom).getTime() : null
    const to = dateTo ? new Date(dateTo).getTime() + 86400000 - 1 : null // inclusive of the whole "to" day
    return movements.filter((m) => {
      if (typeFilter !== 'all' && m.type !== typeFilter) return false
      if (productFilter !== 'all' && m.productId !== productFilter) return false
      if (doctorFilter !== 'all' && m.doctor !== doctorFilter) return false
      if (patientFilter !== 'all' && m.patientId !== patientFilter) return false
      if (vendorFilter !== 'all' && m.vendorId !== vendorFilter) return false
      if (labFilter !== 'all' && m.labId !== labFilter) return false
      const created = new Date(m.createdAt).getTime()
      if (from !== null && created < from) return false
      if (to !== null && created > to) return false
      if (q) {
        const product = productById.get(m.productId)
        const hay = `${product?.name ?? ''} ${product?.sku ?? ''} ${m.reason} ${m.reference ?? ''}`.toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })
  }, [movements, typeFilter, productFilter, doctorFilter, patientFilter, vendorFilter, labFilter, dateFrom, dateTo, search, productById])

  function linkedTo(m: (typeof movements)[number]): string {
    const parts: string[] = []
    if (m.vendorId) parts.push(vendorById.get(m.vendorId)?.name ?? '—')
    if (m.labId) parts.push(labById.get(m.labId)?.name ?? '—')
    if (m.patientId) {
      const patient = patientById.get(m.patientId)
      if (patient) parts.push(patientFullName(patient))
    }
    if (m.doctor) parts.push(m.doctor)
    return parts.length > 0 ? parts.join(' · ') : '—'
  }

  const handleExportCsv = () => {
    const rows = filtered.map((m) => {
      const product = productById.get(m.productId)
      const user = userById.get(m.performedBy)
      return {
        Product: product?.name ?? '',
        SKU: product?.sku ?? '',
        Type: TYPE_LABEL[m.type],
        'Quantity Before': m.quantityBefore,
        'Quantity Change': m.quantity,
        'Quantity After': m.quantityAfter,
        ...(clinicSettings.batchLotTrackingEnabled ? { 'Batch / Lot': m.batchLot ?? '' } : {}),
        'Linked To': linkedTo(m),
        Reason: m.reason,
        Reference: m.reference ?? '',
        'Performed By': user?.name ?? '',
        Date: formatDateTime(m.createdAt),
      }
    })
    exportToCsv(rows, `inventory-movements-${new Date().toISOString().slice(0, 10)}.csv`)
  }

  const productOptions = [{ value: 'all', label: 'All products' }, ...productComboboxOptions(products, (p) => `${p.name} · ${p.sku}`)]
  const doctorOptions = [{ value: 'all', label: 'All doctors' }, ...doctors.map((d) => ({ value: `Dr. ${d.name}`, label: `Dr. ${d.name}`, searchValue: d.name }))]
  const patientOptions = [{ value: 'all', label: 'All patients' }, ...patients.map((p) => ({ value: p.id, label: `${patientFullName(p)} · ${p.patientCode}` }))]
  const vendorOptions = [{ value: 'all', label: 'All vendors' }, ...vendors.map((v) => ({ value: v.id, label: v.name }))]
  const labOptions = [{ value: 'all', label: 'All labs' }, ...labs.map((l) => ({ value: l.id, label: l.name }))]
  const typeOptions = [{ value: 'all', label: 'All movement types' }, ...FILTERABLE_TYPES.map((t) => ({ value: t, label: TYPE_LABEL[t] }))]

  return (
    <div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-6">
        <StatCard label="Total Stock Movements" value={String(stats.total)} icon={SlidersHorizontal} helpTerm="stockMovement" />
        <StatCard label="Units Inbound" value={String(stats.inbound)} icon={ArrowDownToLine} tone="success" />
        <StatCard label="Units Outbound" value={String(stats.outbound)} icon={ArrowUpFromLine} tone="danger" />
        <StatCard label="Manual Adjustments" value={String(stats.adjustments)} icon={SlidersHorizontal} tone="warning" helpTerm="adjustment" />
      </div>

      <StickyActionHeader
        title={PAGE_INTROS.inventory.title}
        description={PAGE_INTROS.inventory.description}
        actions={
          <>
            <Button variant="outline" onClick={handleExportCsv} disabled={filtered.length === 0}>
              <Download className="h-4 w-4" /> Export CSV
            </Button>
            <Button onClick={() => setAdjustOpen(true)}>
              <Plus className="h-4 w-4" /> New Adjustment
            </Button>
          </>
        }
        toolbarClassName="sm:flex-wrap"
        toolbar={
          <>
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Search product, reason, reference..." className="pl-8" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <Combobox className="w-full sm:w-44" options={typeOptions} value={typeFilter} onChange={setTypeFilter} placeholder="Movement Type" searchPlaceholder="Search types..." triggerAriaLabel="Filter by movement type" />
            <Combobox className="w-full sm:w-52" options={productOptions} value={productFilter} onChange={setProductFilter} placeholder="Product" searchPlaceholder="Search products..." triggerAriaLabel="Filter by product" />
            <Combobox className="w-full sm:w-48" options={doctorOptions} value={doctorFilter} onChange={setDoctorFilter} placeholder="Doctor" searchPlaceholder="Search doctors..." triggerAriaLabel="Filter by doctor" />
            <Combobox className="w-full sm:w-48" options={patientOptions} value={patientFilter} onChange={setPatientFilter} placeholder="Patient" searchPlaceholder="Search patients..." triggerAriaLabel="Filter by patient" />
            <Combobox className="w-full sm:w-44" options={vendorOptions} value={vendorFilter} onChange={setVendorFilter} placeholder="Vendor" searchPlaceholder="Search vendors..." triggerAriaLabel="Filter by vendor" />
            <Combobox className="w-full sm:w-44" options={labOptions} value={labFilter} onChange={setLabFilter} placeholder="Lab" searchPlaceholder="Search labs..." triggerAriaLabel="Filter by lab" />
            <div className="flex items-center gap-1.5">
              <Input type="date" aria-label="From date" className="w-full sm:w-36" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
              <span className="text-xs text-muted-foreground">to</span>
              <Input type="date" aria-label="To date" className="w-full sm:w-36" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
            </div>
          </>
        }
      />

      {filtered.length === 0 ? (
        <EmptyState
          icon={Search}
          title={EMPTY_STATES.inventory.title}
          description={EMPTY_STATES.inventory.description}
          action={
            <Button size="sm" onClick={() => setAdjustOpen(true)}>
              <Plus className="h-4 w-4" /> {EMPTY_STATES.inventory.actionLabel}
            </Button>
          }
        />
      ) : (
        <div className="rounded-xl border border-border bg-card overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="text-right whitespace-nowrap">Balance</TableHead>
                {clinicSettings.batchLotTrackingEnabled && <TableHead>Batch / Lot</TableHead>}
                <TableHead>Linked to</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead>Reference</TableHead>
                <TableHead>By</TableHead>
                <TableHead>Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.slice(0, 100).map((m) => {
                const product = productById.get(m.productId)
                const user = userById.get(m.performedBy)
                return (
                  <TableRow key={m.id}>
                    <TableCell>
                      <p className="font-medium">{product?.name}</p>
                      <p className="text-xs text-muted-foreground">{product?.sku}</p>
                    </TableCell>
                    <TableCell><Badge variant={TYPE_VARIANT[m.type]}>{TYPE_LABEL[m.type]}</Badge></TableCell>
                    <TableCell className="text-right whitespace-nowrap tabular-nums">
                      <span className="text-muted-foreground">{m.quantityBefore}</span>
                      {' → '}
                      <span className="font-medium">{m.quantityAfter}</span>
                      <span className={m.quantity >= 0 ? 'ml-1.5 text-success-600' : 'ml-1.5 text-danger-600'}>
                        ({m.quantity >= 0 ? '+' : ''}{m.quantity})
                      </span>
                    </TableCell>
                    {clinicSettings.batchLotTrackingEnabled && <TableCell className="text-muted-foreground">{m.batchLot ?? '—'}</TableCell>}
                    <TableCell className="max-w-[200px] truncate text-muted-foreground">{linkedTo(m)}</TableCell>
                    <TableCell className="max-w-[200px] truncate">{m.reason}</TableCell>
                    <TableCell className="text-muted-foreground">{m.reference ?? '—'}</TableCell>
                    <TableCell className="text-muted-foreground">{user?.name ?? '—'}</TableCell>
                    <TableCell className="text-muted-foreground whitespace-nowrap">{formatDateTime(m.createdAt)}</TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <AdjustmentDialog open={adjustOpen} onOpenChange={setAdjustOpen} />
    </div>
  )
}
