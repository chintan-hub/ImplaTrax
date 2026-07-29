import { useMemo, useState } from 'react'
import { ArrowDownToLine, ArrowUpFromLine, SlidersHorizontal, Plus, Search, Download } from 'lucide-react'
import { PageHeader } from '@/components/shared/PageHeader'
import { StickyToolbar } from '@/components/shared/StickyToolbar'
import { StatCard } from '@/components/shared/StatCard'
import { EmptyState } from '@/components/shared/EmptyState'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { AdjustmentDialog } from '@/components/inventory/AdjustmentDialog'
import { useData } from '@/store/DataContext'
import { formatDateTime } from '@/lib/utils'
import { exportToCsv } from '@/lib/documents/csv'
import { PAGE_INTROS, EMPTY_STATES } from '@/content/helpText'
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

export function InventoryPage() {
  const { movements, products, users, clinicSettings } = useData()
  const [tab, setTab] = useState<'all' | 'inbound' | 'outbound' | 'adjustment'>('all')
  const [search, setSearch] = useState('')
  const [adjustOpen, setAdjustOpen] = useState(false)

  const productById = useMemo(() => new Map(products.map((p) => [p.id, p])), [products])
  const userById = useMemo(() => new Map(users.map((u) => [u.id, u])), [users])

  const stats = useMemo(() => {
    const inbound = movements.filter((m) => m.quantity > 0).reduce((s, m) => s + m.quantity, 0)
    const outbound = movements.filter((m) => m.quantity < 0).reduce((s, m) => s + Math.abs(m.quantity), 0)
    const adjustments = movements.filter((m) => m.type === 'adjustment').length
    return { inbound, outbound, adjustments, total: movements.length }
  }, [movements])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return movements.filter((m) => {
      if (tab === 'inbound' && !(m.quantity > 0)) return false
      if (tab === 'outbound' && !(m.quantity < 0 && m.type !== 'adjustment')) return false
      if (tab === 'adjustment' && m.type !== 'adjustment') return false
      if (q) {
        const product = productById.get(m.productId)
        const hay = `${product?.name ?? ''} ${product?.sku ?? ''} ${m.reason} ${m.reference ?? ''}`.toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })
  }, [movements, tab, search, productById])

  const handleExportCsv = () => {
    const rows = filtered.map((m) => {
      const product = productById.get(m.productId)
      const user = userById.get(m.performedBy)
      return {
        Product: product?.name ?? '',
        SKU: product?.sku ?? '',
        Type: TYPE_LABEL[m.type],
        Quantity: m.quantity,
        ...(clinicSettings.batchLotTrackingEnabled ? { 'Batch / Lot': m.batchLot ?? '' } : {}),
        Reason: m.reason,
        Reference: m.reference ?? '',
        'Performed By': user?.name ?? '',
        Date: formatDateTime(m.createdAt),
      }
    })
    exportToCsv(rows, `inventory-movements-${new Date().toISOString().slice(0, 10)}.csv`)
  }

  return (
    <div>
      <PageHeader
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
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-6">
        <StatCard label="Total Stock Movements" value={String(stats.total)} icon={SlidersHorizontal} helpTerm="stockMovement" />
        <StatCard label="Units Inbound" value={String(stats.inbound)} icon={ArrowDownToLine} tone="success" />
        <StatCard label="Units Outbound" value={String(stats.outbound)} icon={ArrowUpFromLine} tone="danger" />
        <StatCard label="Manual Adjustments" value={String(stats.adjustments)} icon={SlidersHorizontal} tone="warning" helpTerm="adjustment" />
      </div>

      <StickyToolbar className="sm:justify-between">
        <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
          <TabsList>
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="inbound">Inbound</TabsTrigger>
            <TabsTrigger value="outbound">Outbound</TabsTrigger>
            <TabsTrigger value="adjustment">Adjustments</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search product, reason, reference..." className="pl-8" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      </StickyToolbar>

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
        <div className="rounded-xl border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="text-right">Quantity</TableHead>
                {clinicSettings.batchLotTrackingEnabled && <TableHead>Batch / Lot</TableHead>}
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
                    <TableCell className={m.quantity >= 0 ? 'text-right text-success-600 font-medium tabular-nums' : 'text-right text-danger-600 font-medium tabular-nums'}>
                      {m.quantity >= 0 ? '+' : ''}{m.quantity}
                    </TableCell>
                    {clinicSettings.batchLotTrackingEnabled && <TableCell className="text-muted-foreground">{m.batchLot ?? '—'}</TableCell>}
                    <TableCell className="max-w-[220px] truncate">{m.reason}</TableCell>
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
