import { useState } from 'react'
import { toast } from 'sonner'
import { Plus, Trash2 } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import { useData } from '@/store/DataContext'
import { MICROCOPY } from '@/content/helpText'
import { simulateLatency } from '@/lib/utils'

interface Line {
  productId: string
  quantityOrdered: number
  unitCost: number
}

export function POFormDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { vendors, products, createPurchaseOrder } = useData()
  const [vendorId, setVendorId] = useState('')
  const [eta, setEta] = useState(() => new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10))
  const [lines, setLines] = useState<Line[]>([])
  const [submitting, setSubmitting] = useState(false)

  const vendorProducts = vendorId ? products.filter((p) => vendors.find((v) => v.id === vendorId)?.manufacturers.includes(p.manufacturer)) : products

  const addLine = () => {
    const p = vendorProducts[0]
    if (!p) return
    setLines((prev) => [...prev, { productId: p.id, quantityOrdered: 10, unitCost: p.unitCost }])
  }

  const updateLine = (i: number, patch: Partial<Line>) => {
    setLines((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l)))
  }

  const removeLine = (i: number) => setLines((prev) => prev.filter((_, idx) => idx !== i))

  const reset = () => {
    setVendorId('')
    setLines([])
  }

  const handleSubmit = async () => {
    if (!vendorId) {
      toast.error('Select a vendor.')
      return
    }
    if (lines.length === 0) {
      toast.error('Add at least one line item.')
      return
    }
    setSubmitting(true)
    await simulateLatency()
    const po = createPurchaseOrder(vendorId, lines, new Date(eta).toISOString())
    toast.success(`Purchase order ${po.poNumber} created`, { description: 'Saved as draft.' })
    setSubmitting(false)
    reset()
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v) }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>New Purchase Order</DialogTitle>
          <DialogDescription>Create a draft purchase order to send to your vendor.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Vendor</Label>
              <Select value={vendorId} onValueChange={(v) => { setVendorId(v); setLines([]) }}>
                <SelectTrigger><SelectValue placeholder="Select vendor" /></SelectTrigger>
                <SelectContent>
                  {vendors.map((v) => <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="eta">Expected delivery (ETA)</Label>
              <Input id="eta" type="date" value={eta} onChange={(e) => setEta(e.target.value)} />
              <p className="text-xs text-muted-foreground">{MICROCOPY.eta}</p>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <Label>Line items</Label>
              <Button type="button" size="sm" variant="outline" onClick={addLine} disabled={!vendorId}>
                <Plus className="h-3.5 w-3.5" /> Add line
              </Button>
            </div>
            {lines.length > 0 && (
              <div className="mb-1 hidden items-center gap-2 px-2 text-xs text-muted-foreground sm:flex">
                <span className="flex-1">Product</span>
                <span className="w-20">Quantity</span>
                <span className="w-24">Purchase Price</span>
                <span className="w-9" />
              </div>
            )}
            <div className="space-y-2">
              {lines.map((line, i) => (
                <div key={i} className="flex flex-col gap-2 rounded-lg border border-border p-2 sm:flex-row sm:items-center">
                  <Select value={line.productId} onValueChange={(v) => updateLine(i, { productId: v, unitCost: products.find((p) => p.id === v)?.unitCost ?? line.unitCost })}>
                    <SelectTrigger className="flex-1"><SelectValue /></SelectTrigger>
                    <SelectContent className="max-h-72">
                      {vendorProducts.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      className="w-20"
                      aria-label="Quantity"
                      value={line.quantityOrdered}
                      onChange={(e) => updateLine(i, { quantityOrdered: Math.max(1, Number(e.target.value) || 1) })}
                    />
                    <Input
                      type="number"
                      className="w-24"
                      step="0.01"
                      aria-label="Purchase price"
                      value={line.unitCost}
                      onChange={(e) => updateLine(i, { unitCost: Math.max(0, Number(e.target.value) || 0) })}
                    />
                    <Button type="button" size="icon" variant="ghost" className="shrink-0" onClick={() => removeLine(i)} aria-label="Remove line item">
                      <Trash2 className="h-4 w-4 text-danger-600" />
                    </Button>
                  </div>
                </div>
              ))}
              {lines.length === 0 && <p className="text-sm text-muted-foreground">No line items yet. Select a vendor and add a line.</p>}
            </div>
            {lines.length > 0 && <p className="mt-1 text-xs text-muted-foreground">{MICROCOPY.purchasePrice}</p>}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>Cancel</Button>
          <Button onClick={handleSubmit} loading={submitting}>Create Draft Purchase Order</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
