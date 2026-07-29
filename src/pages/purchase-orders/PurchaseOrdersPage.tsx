import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Plus, Search } from 'lucide-react'
import { PageHeader } from '@/components/shared/PageHeader'
import { StickyToolbar } from '@/components/shared/StickyToolbar'
import { EmptyState } from '@/components/shared/EmptyState'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { Progress } from '@/components/ui/progress'
import { POFormDialog } from '@/components/purchase-orders/POFormDialog'
import { POStatusActions } from '@/components/purchase-orders/POStatusActions'
import { useData } from '@/store/DataContext'
import { formatCurrency, formatDate } from '@/lib/utils'
import { PAGE_INTROS, EMPTY_STATES } from '@/content/helpText'
import type { POStatus } from '@/types'

const STATUSES: POStatus[] = ['draft', 'submitted', 'confirmed', 'partially-received', 'received', 'cancelled']

export function PurchaseOrdersPage() {
  const { purchaseOrders, vendors } = useData()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('all')
  const [formOpen, setFormOpen] = useState(false)

  useEffect(() => {
    if (params.get('new') === '1') {
      setFormOpen(true)
      params.delete('new')
      setParams(params, { replace: true })
    }
  }, [params, setParams])

  const vendorById = useMemo(() => new Map(vendors.map((v) => [v.id, v])), [vendors])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return purchaseOrders.filter((po) => {
      if (status !== 'all' && po.status !== status) return false
      if (q) {
        const vendor = vendorById.get(po.vendorId)
        if (!(po.poNumber.toLowerCase().includes(q) || vendor?.name.toLowerCase().includes(q))) return false
      }
      return true
    })
  }, [purchaseOrders, search, status, vendorById])

  return (
    <div>
      <PageHeader
        title={PAGE_INTROS.purchaseOrders.title}
        helpTerm="purchaseOrder"
        description={PAGE_INTROS.purchaseOrders.description}
        actions={
          <Button onClick={() => setFormOpen(true)}>
            <Plus className="h-4 w-4" /> New Purchase Order
          </Button>
        }
      />

      <StickyToolbar>
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search PO number or vendor..." className="pl-8" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-full sm:w-52"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
      </StickyToolbar>

      {filtered.length === 0 ? (
        <EmptyState
          icon={Search}
          title={EMPTY_STATES.purchaseOrders.title}
          description={EMPTY_STATES.purchaseOrders.description}
          action={
            <Button size="sm" onClick={() => setFormOpen(true)}>
              <Plus className="h-4 w-4" /> {EMPTY_STATES.purchaseOrders.actionLabel}
            </Button>
          }
        />
      ) : (
        <div className="rounded-xl border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>PO Number</TableHead>
                <TableHead>Vendor</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Receiving Progress</TableHead>
                <TableHead>ETA</TableHead>
                <TableHead className="text-right">Total Cost</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((po) => {
                const vendor = vendorById.get(po.vendorId)
                const totalOrdered = po.lines.reduce((s, l) => s + l.quantityOrdered, 0)
                const totalReceived = po.lines.reduce((s, l) => s + l.quantityReceived, 0)
                const totalCost = po.lines.reduce((s, l) => s + l.quantityOrdered * l.unitCost, 0)
                const progress = totalOrdered > 0 ? Math.round((totalReceived / totalOrdered) * 100) : 0
                return (
                  <TableRow key={po.id} className="cursor-pointer" onClick={() => navigate(`/purchase-orders/${po.id}`)}>
                    <TableCell className="font-medium font-mono">{po.poNumber}</TableCell>
                    <TableCell>{vendor?.name}</TableCell>
                    <TableCell><StatusBadge status={po.status} /></TableCell>
                    <TableCell className="w-40">
                      <div className="flex items-center gap-2">
                        <Progress value={progress} className="h-1.5" />
                        <span className="text-xs text-muted-foreground w-8 shrink-0">{progress}%</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground whitespace-nowrap">{formatDate(po.eta)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatCurrency(totalCost)}</TableCell>
                    <TableCell className="text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                      <POStatusActions po={po} size="sm" />
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <POFormDialog open={formOpen} onOpenChange={setFormOpen} />
    </div>
  )
}
