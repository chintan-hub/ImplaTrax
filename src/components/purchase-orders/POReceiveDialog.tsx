import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PhotoDropzone } from '@/components/shared/PhotoDropzone'
import { useData } from '@/store/DataContext'
import { MICROCOPY } from '@/content/helpText'
import { simulateLatency } from '@/lib/utils'
import type { PurchaseOrder } from '@/types'

const PARTIAL_PHOTO_ERROR = 'Please attach at least one photo of the delivery slip or package to document this partial receipt.'

export function POReceiveDialog({ po, open, onOpenChange }: { po: PurchaseOrder | null; open: boolean; onOpenChange: (v: boolean) => void }) {
  const { products, receivePurchaseOrder, clinicSettings } = useData()
  const [quantities, setQuantities] = useState<Record<string, number>>({})
  const [lotNumbers, setLotNumbers] = useState<Record<string, string>>({})
  const [expiryDates, setExpiryDates] = useState<Record<string, string>>({})
  const [photos, setPhotos] = useState<string[]>([])
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (po) {
      const initial: Record<string, number> = {}
      po.lines.forEach((l) => {
        initial[l.id] = Math.max(0, l.quantityOrdered - l.quantityReceived)
      })
      setQuantities(initial)
      setLotNumbers({})
      setExpiryDates({})
      setPhotos([])
    }
  }, [po])

  if (!po) return null

  // Every received line requires a lot number when tracking is on — Batch/Lot
  // belongs to the receipt event, not the product definition, so this does not
  // consult Product.batchTracked (PROJECT.md §3 point 5, locked 2026-07-29).
  const missingLot = po.lines.some((line) => {
    const qty = quantities[line.id] ?? 0
    if (qty <= 0) return false
    return clinicSettings.batchLotTrackingEnabled && !lotNumbers[line.id]?.trim()
  })

  // Mandatory Partial Receipt Photo rule (CRITICAL, PROJECT.md §3): this
  // receipt is "partial" the moment any line's entered quantity comes in
  // short of what's currently outstanding for it — whether under-received
  // this time or left untouched. Mirrors the same check enforced in
  // DataContext.receivePurchaseOrder, which is the actual source of truth.
  const isPartialReceive = po.lines.some((line) => {
    const remainingQty = line.quantityOrdered - line.quantityReceived
    const receivingQty = quantities[line.id] ?? 0
    return receivingQty < remainingQty
  })
  const missingPartialPhoto = isPartialReceive && photos.length === 0

  const handleSubmit = async () => {
    const receipts = Object.entries(quantities)
      .filter(([, qty]) => qty > 0)
      .map(([lineId, quantityReceived]) => ({
        lineId,
        quantityReceived,
        lotNumber: lotNumbers[lineId]?.trim() || undefined,
        expiryDate: expiryDates[lineId] || undefined,
      }))
    if (receipts.length === 0) {
      toast.error('Enter a quantity to receive for at least one line.')
      return
    }
    if (missingLot) {
      toast.error('Enter a lot/batch number for every line being received.')
      return
    }
    if (missingPartialPhoto) {
      toast.error(PARTIAL_PHOTO_ERROR)
      return
    }
    setSubmitting(true)
    try {
      await simulateLatency()
      receivePurchaseOrder(po.id, receipts, photos.length > 0 ? photos : undefined)
      toast.success(`Received items for ${po.poNumber}`, { description: 'Inventory updated and stock movement history recorded.' })
      onOpenChange(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not receive this purchase order.')
    } finally {
      setSubmitting(false)
    }
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
            const qty = quantities[line.id] ?? 0
            const needsLot = clinicSettings.batchLotTrackingEnabled && qty > 0
            return (
              <div key={line.id} className="rounded-lg border border-border p-3">
                <div className="flex items-center justify-between gap-3">
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
                      value={qty}
                      onChange={(e) => setQuantities((prev) => ({ ...prev, [line.id]: Math.min(remaining, Math.max(0, Number(e.target.value) || 0)) }))}
                    />
                  </div>
                </div>
                {needsLot && (
                  <div className="mt-2">
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      <div>
                        <Label htmlFor={`lot-${line.id}`} className="sr-only">Lot / Batch number</Label>
                        <Input
                          id={`lot-${line.id}`}
                          placeholder="Lot / Batch number (required)"
                          aria-label="Lot / Batch number"
                          value={lotNumbers[line.id] ?? ''}
                          onChange={(e) => setLotNumbers((prev) => ({ ...prev, [line.id]: e.target.value }))}
                        />
                      </div>
                      <div>
                        <Label htmlFor={`exp-${line.id}`} className="sr-only">Expiry date</Label>
                        <Input
                          id={`exp-${line.id}`}
                          type="date"
                          aria-label="Expiry date (optional)"
                          value={expiryDates[line.id] ?? ''}
                          onChange={(e) => setExpiryDates((prev) => ({ ...prev, [line.id]: e.target.value }))}
                        />
                      </div>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{MICROCOPY.receivingLot} Expiry is optional — leave it blank if the component doesn't expire.</p>
                  </div>
                )}
                {needsLot && !lotNumbers[line.id]?.trim() && (
                  <p className="mt-1.5 text-xs text-danger-600">A lot/batch number is required to receive this line.</p>
                )}
              </div>
            )
          })}
        </div>

        <PhotoDropzone
          label={isPartialReceive ? 'Shipment Photos (Required for Partial Receipt)' : 'Shipment Photos / Delivery Slip (Optional)'}
          photos={photos}
          onChange={setPhotos}
          required={isPartialReceive}
          error={missingPartialPhoto ? PARTIAL_PHOTO_ERROR : undefined}
          helpText={isPartialReceive ? undefined : 'Attach a photo of the packing slip or delivered package for your records.'}
        />

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>Cancel</Button>
          <Button onClick={handleSubmit} loading={submitting} disabled={missingLot || missingPartialPhoto}>Confirm Receipt</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
