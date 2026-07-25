import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useData } from '@/store/DataContext'
import { simulateLatency } from '@/lib/utils'
import type { PurchaseOrder } from '@/types'

export function POReceiveDialog({ po, open, onOpenChange }: { po: PurchaseOrder | null; open: boolean; onOpenChange: (v: boolean) => void }) {
  const { products, receivePurchaseOrder } = useData()
  const [quantities, setQuantities] = useState<Record<string, number>>({})
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (po) {
      const initial: Record<string, number> = {}
      po.lines.forEach((l) => {
        initial[l.id] = Math.max(0, l.quantityOrdered - l.quantityReceived)
      })
      setQuantities(initial)
    }
  }, [po])

  if (!po) return null

  const handleSubmit = async () => {
    const receipts = Object.entries(quantities)
      .filter(([, qty]) => qty > 0)
      .map(([lineId, quantityReceived]) => ({ lineId, quantityReceived }))
    if (receipts.length === 0) {
      toast.error('Enter a quantity to receive for at least one line.')
      return
    }
    setSubmitting(true)
    await simulateLatency()
    receivePurchaseOrder(po.id, receipts)
    toast.success(`Received items for ${po.poNumber}`, { description: 'Inventory updated and stock movement history recorded.' })
    setSubmitting(false)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Receive {po.poNumber}</DialogTitle>
          <DialogDescription>Enter the quantity received for each line item. Partial receiving is supported.</DialogDescription>
        </DialogHeader>

        <div className="space-y-3 max-h-96 overflow-y-auto scrollbar-thin">
          {po.lines.map((line) => {
            const product = products.find((p) => p.id === line.productId)
            const remaining = line.quantityOrdered - line.quantityReceived
            return (
              <div key={line.id} className="flex items-center justify-between gap-3 rounded-lg border border-border p-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{product?.name}</p>
                  <p className="text-xs text-muted-foreground">
                    Ordered {line.quantityOrdered} · Received {line.quantityReceived} · Remaining {remaining}
                  </p>
                </div>
                <div className="w-24">
                  <Label htmlFor={`recv-${line.id}`} className="sr-only">Quantity</Label>
                  <Input
                    id={`recv-${line.id}`}
                    type="number"
                    min={0}
                    max={remaining}
                    value={quantities[line.id] ?? 0}
                    onChange={(e) => setQuantities((prev) => ({ ...prev, [line.id]: Math.min(remaining, Math.max(0, Number(e.target.value) || 0)) }))}
                  />
                </div>
              </div>
            )
          })}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>Cancel</Button>
          <Button onClick={handleSubmit} loading={submitting}>Confirm Receipt</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
