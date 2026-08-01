import { useState } from 'react'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Combobox } from '@/components/ui/combobox'
import { useData } from '@/store/DataContext'
import { MICROCOPY } from '@/content/helpText'
import { simulateLatency } from '@/lib/utils'
import { productComboboxOptions } from '@/lib/productOptions'

export function AdjustmentDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { products, adjustStock } = useData()
  const [productId, setProductId] = useState('')
  const [direction, setDirection] = useState<'in' | 'out'>('in')
  const [quantity, setQuantity] = useState(1)
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const reset = () => {
    setProductId('')
    setDirection('in')
    setQuantity(1)
    setReason('')
  }

  const handleSubmit = async () => {
    if (!productId) {
      toast.error('Select a product to adjust.')
      return
    }
    if (!reason.trim()) {
      toast.error('A reason is required for manual stock adjustments.')
      return
    }
    setSubmitting(true)
    await simulateLatency()
    try {
      const delta = direction === 'in' ? quantity : -quantity
      adjustStock(productId, delta, reason.trim())
      const product = products.find((p) => p.id === productId)
      toast.success(`Adjusted ${product?.name}`, { description: `${direction === 'in' ? '+' : '-'}${quantity} · ${reason}` })
      reset()
      onOpenChange(false)
    } catch (err) {
      toast.error('Could not save adjustment', { description: err instanceof Error ? err.message : undefined })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v) }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Manual Stock Adjustment</DialogTitle>
          <DialogDescription>Every adjustment requires a reason and is recorded in inventory history.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Product</Label>
            <Combobox
              options={productComboboxOptions(products, (p) => `${p.name} · ${p.sku}`)}
              value={productId}
              onChange={setProductId}
              placeholder="Select a product"
              searchPlaceholder="Search name, SKU, system, diameter..."
              emptyText="No products found."
              triggerAriaLabel="Product"
            />
          </div>

          <div className="space-y-1.5">
            <Label>Direction</Label>
            <Tabs value={direction} onValueChange={(v) => setDirection(v as 'in' | 'out')}>
              <TabsList className="w-full">
                <TabsTrigger value="in" className="flex-1">Stock In</TabsTrigger>
                <TabsTrigger value="out" className="flex-1">Stock Out</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="qty">Quantity</Label>
            <Input id="qty" type="number" min={1} value={quantity} onChange={(e) => setQuantity(Math.max(1, Number(e.target.value) || 1))} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="reason">Reason (required)</Label>
            <Input id="reason" placeholder="e.g. Cycle count adjustment" value={reason} onChange={(e) => setReason(e.target.value)} />
            <p className="text-xs text-muted-foreground">{MICROCOPY.reason}</p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>Cancel</Button>
          <Button onClick={handleSubmit} loading={submitting}>Save Adjustment</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
