import { useMemo, useState } from 'react'
import { ArrowDownToLine, ArrowUpFromLine, SlidersHorizontal, Plus, Search } from 'lucide-react'
import { PageHeader } from '@/components/shared/PageHeader'
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
import { userById } from '@/mocks/users'
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
  const { movements, products } = useData()
  const [tab, setTab] = useState<'all' | 'inbound' | 'outbound' | 'adjustment'>('all')
  const [search, setSearch] = useState('')
  const [adjustOpen, setAdjustOpen] = useState(false)

  const productById = useMemo(() => new Map(products.map((p) => [p.id, p])), [products])

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

  return (
    <div>
      <PageHeader
        title={PAGE_INTROS.inventory.title}
        description={PAGE_INTROS.inventory.description}
        actions={
          <Button onClick={() => setAdjustOpen(true)}>
            <Plus className="h-4 w-4" /> New Adjustment
          </Button>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-6">
        <StatCard label="Total Stock Movements" value={String(stats.total)} icon={SlidersHorizontal} helpTerm="stockMovement" />
        <StatCard label="Units Inbound" value={String(stats.inbound)} icon={ArrowDownToLine} tone="success" />
        <StatCard label="Units Outbound" value={String(stats.outbound)} icon={ArrowUpFromLine} tone="danger" />
        <StatCard label="Manual Adjustments" value={String(stats.adjustments)} icon={SlidersHorizontal} tone="warning" helpTerm="adjustment" />
      </div>

      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
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
      </div>

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
                <TableHead>Reason</TableHead>
                <TableHead>Reference</TableHead>
                <TableHead>By</TableHead>
                <TableHead>Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.slice(0, 100).map((m) => {
                const product = productById.get(m.productId)
                const user = userById(m.performedBy)
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
