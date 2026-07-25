import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { Plus, Search, PackageCheck, Send, XCircle } from 'lucide-react'
import { PageHeader } from '@/components/shared/PageHeader'
import { EmptyState } from '@/components/shared/EmptyState'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { Progress } from '@/components/ui/progress'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { POFormDialog } from '@/components/purchase-orders/POFormDialog'
import { POReceiveDialog } from '@/components/purchase-orders/POReceiveDialog'
import { IconHelp } from '@/components/ui/help-tooltip'
import { useData } from '@/store/DataContext'
import { formatCurrency, formatDate } from '@/lib/utils'
import { PAGE_INTROS, EMPTY_STATES } from '@/content/helpText'
import type { PurchaseOrder, POStatus } from '@/types'

const STATUSES: POStatus[] = ['draft', 'submitted', 'confirmed', 'partially-received', 'received', 'cancelled']

export function PurchaseOrdersPage() {
  const { purchaseOrders, vendors, submitPurchaseOrder, cancelPurchaseOrder } = useData()
  const [params] = useSearchParams()
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('all')
  const [formOpen, setFormOpen] = useState(params.get('new') === '1')
  const [receivingPO, setReceivingPO] = useState<PurchaseOrder | null>(null)
  const [cancelingPO, setCancelingPO] = useState<PurchaseOrder | null>(null)

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

      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center">
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
      </div>

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
                const canReceive = ['submitted', 'confirmed', 'partially-received'].includes(po.status)
                const canSubmit = po.status === 'draft'
                const canCancel = ['draft', 'submitted', 'confirmed'].includes(po.status)
                return (
                  <TableRow key={po.id}>
                    <TableCell className="font-medium">{po.poNumber}</TableCell>
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
                    <TableCell className="text-right space-x-1.5 whitespace-nowrap">
                      {canSubmit && (
                        <Button size="sm" variant="outline" onClick={() => { submitPurchaseOrder(po.id); toast.success(`${po.poNumber} submitted to vendor`, { description: 'Status updated to Submitted.' }) }}>
                          <Send className="h-3.5 w-3.5" /> Submit
                        </Button>
                      )}
                      {canReceive && (
                        <IconHelp helpKey="receive">
                          <Button size="sm" onClick={() => setReceivingPO(po)}>
                            <PackageCheck className="h-3.5 w-3.5" /> Receive
                          </Button>
                        </IconHelp>
                      )}
                      {canCancel && (
                        <Button size="sm" variant="ghost" className="text-danger-600 hover:text-danger-700 hover:bg-danger/10" onClick={() => setCancelingPO(po)} aria-label={`Cancel purchase order ${po.poNumber}`}>
                          <XCircle className="h-3.5 w-3.5" /> Cancel
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <POFormDialog open={formOpen} onOpenChange={setFormOpen} />
      <POReceiveDialog po={receivingPO} open={!!receivingPO} onOpenChange={(v) => !v && setReceivingPO(null)} />
      <ConfirmDialog
        open={!!cancelingPO}
        onOpenChange={(v) => !v && setCancelingPO(null)}
        title={`Cancel ${cancelingPO?.poNumber}?`}
        description="This purchase order will be marked cancelled and can no longer be submitted or received. This cannot be undone."
        confirmLabel="Cancel Purchase Order"
        cancelLabel="Keep Order"
        tone="destructive"
        onConfirm={() => {
          if (!cancelingPO) return
          cancelPurchaseOrder(cancelingPO.id)
          toast.success(`${cancelingPO.poNumber} cancelled`)
        }}
      />
    </div>
  )
}
