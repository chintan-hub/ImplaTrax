import { useState } from 'react'
import { toast } from 'sonner'
import { Minus, Plus, Package, Pencil } from 'lucide-react'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetBody, SheetFooter } from '@/components/ui/sheet'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { BarcodeDisplay, QRDisplay } from '@/components/shared/Barcode'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { TermHint } from '@/components/ui/help-tooltip'
import { useData } from '@/store/DataContext'
import { formatCurrency, formatDate, formatDateTime, simulateLatency } from '@/lib/utils'
import { MICROCOPY } from '@/content/helpText'
import { patientFullName } from '@/mocks/patients'
import { summarizeLots } from '@/lib/batches'
import { stockStatus, availableStock, STOCK_STATUS_LABEL } from '@/lib/stock'
import { ProductFormDialog } from '@/components/products/ProductFormDialog'
import type { Product, InventoryMovement } from '@/types'

const STOCK_STATUS_VARIANT = { normal: 'success', low: 'warning', out: 'danger' } as const

/** One capped, labeled slice of a product's movement history — the full, unfiltered ledger lives on the Inventory History page. */
function HistorySection({
  label,
  emptyText,
  movements,
  primaryLabel,
}: {
  label: string
  emptyText: string
  movements: InventoryMovement[]
  primaryLabel: (m: InventoryMovement) => string
}) {
  const shown = movements.slice(0, 5)
  return (
    <div>
      <p className="mb-1.5 text-xs font-medium text-muted-foreground">{label}</p>
      <div className="space-y-2">
        {shown.map((m) => (
          <div key={m.id} className="flex items-center justify-between gap-2 text-xs">
            <div className="min-w-0">
              <p className="truncate font-medium text-foreground">{primaryLabel(m)}</p>
              <p className="text-muted-foreground">{formatDateTime(m.createdAt)}{m.reference ? ` · ${m.reference}` : ''}</p>
            </div>
            <span className={m.quantity >= 0 ? 'shrink-0 text-success-600 font-medium' : 'shrink-0 text-danger-600 font-medium'}>
              {m.quantity >= 0 ? '+' : ''}{m.quantity}
            </span>
          </div>
        ))}
        {movements.length === 0 && <p className="text-xs text-muted-foreground">{emptyText}</p>}
        {movements.length > shown.length && (
          <p className="text-xs text-muted-foreground">+{movements.length - shown.length} more in Inventory History</p>
        )}
      </div>
    </div>
  )
}

export function ProductDetailSheet({ product, open, onOpenChange }: { product: Product | null; open: boolean; onOpenChange: (v: boolean) => void }) {
  const { movements, adjustStock, vendors, labs, patients, batches, cases, clinicSettings } = useData()
  const [adjustDelta, setAdjustDelta] = useState(1)
  const [reason, setReason] = useState('')
  const [pendingSign, setPendingSign] = useState<1 | -1 | null>(null)
  const [editOpen, setEditOpen] = useState(false)

  if (!product) return null

  const vendor = vendors.find((v) => v.id === product.vendorId)
  const productMovements = movements.filter((m) => m.productId === product.id)
  const purchaseHistory = productMovements.filter((m) => m.type === 'inbound')
  const salesHistory = productMovements.filter((m) => m.type === 'sale')
  const loanHistory = productMovements.filter((m) => m.type === 'loan-out' || m.type === 'loan-return' || m.type === 'lost')
  const adjustmentHistory = productMovements.filter((m) => m.type === 'adjustment')
  const lots = summarizeLots(batches, movements, cases).filter((l) => l.productId === product.id)
  const status = stockStatus(product)

  const handleAdjust = async (sign: 1 | -1) => {
    if (!reason.trim()) {
      toast.error('A reason is required for manual stock adjustments.')
      return
    }
    setPendingSign(sign)
    await simulateLatency()
    adjustStock(product.id, sign * adjustDelta, reason.trim())
    toast.success(`Stock ${sign > 0 ? 'increased' : 'decreased'} by ${adjustDelta}`, { description: reason })
    setReason('')
    setPendingSign(null)
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="max-w-lg w-full sm:max-w-lg">
        <SheetHeader>
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg" style={{ backgroundColor: `${product.imageColor}1a`, color: product.imageColor }}>
                <Package className="h-5 w-5" />
              </div>
              <div>
                <SheetTitle>{product.name}</SheetTitle>
                <SheetDescription className="inline-flex items-center gap-1">
                  <TermHint term="sku" iconOnly /> {product.sku}
                </SheetDescription>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
              <Pencil className="h-3.5 w-3.5" /> Edit
            </Button>
          </div>
        </SheetHeader>

        <SheetBody className="space-y-6 py-4">
          <div className="flex flex-wrap gap-2">
            <StatusBadge status={product.status} />
            <Badge variant={STOCK_STATUS_VARIANT[status]}>{STOCK_STATUS_LABEL[status]}</Badge>
            <Badge variant="outline">{product.manufacturer}</Badge>
            <Badge variant="outline">{product.category}</Badge>
            {clinicSettings.batchLotTrackingEnabled && product.batchTracked && (
              <Badge variant="accent" className="gap-1">
                Batch tracked
                <TermHint term="batchNumber" iconOnly className="text-accent-foreground" />
              </Badge>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">On hand</p>
              <p className="font-medium tabular-nums text-base">{product.quantityOnHand}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Available</p>
              <p className="font-medium tabular-nums text-base">{availableStock(product)}</p>
            </div>
            <div>
              <p className="flex items-center gap-1 text-muted-foreground">
                Reserved <TermHint term="reservedStock" iconOnly />
              </p>
              <p className="font-medium tabular-nums text-base">{product.quantityReserved}</p>
            </div>
            <div>
              <p className="flex items-center gap-1 text-muted-foreground">
                Reorder level <TermHint term="lowStock" iconOnly />
              </p>
              <p className="font-medium tabular-nums text-base">{product.lowStockThreshold}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Vendor</p>
              <p className="font-medium text-base">{vendor?.name ?? '—'}</p>
            </div>
            {product.priceVisible && (
              <>
                <div>
                  <p className="text-muted-foreground">Unit cost</p>
                  <p className="font-medium tabular-nums text-base">{formatCurrency(product.unitCost)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Unit price</p>
                  <p className="font-medium tabular-nums text-base">{formatCurrency(product.unitPrice)}</p>
                </div>
              </>
            )}
          </div>

          <p className="text-sm text-muted-foreground">{product.description}</p>

          <Separator />

          <div>
            <p className="text-sm font-medium mb-3">Identifiers</p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="rounded-lg border border-border bg-white p-3">
                  <BarcodeDisplay value={product.barcode} format={clinicSettings.barcodeFormat} className="w-full" />
                </div>
                <p className="mt-1.5 flex items-center gap-1 text-xs text-muted-foreground">
                  Barcode <TermHint term="barcode" iconOnly />
                </p>
              </div>
              <div>
                <div className="flex items-center justify-center rounded-lg border border-border bg-white p-3">
                  <QRDisplay value={product.qrPayload} size={80} />
                </div>
                <p className="mt-1.5 flex items-center justify-center gap-1 text-xs text-muted-foreground">
                  QR Code <TermHint term="qrCode" iconOnly />
                </p>
              </div>
            </div>
          </div>

          <Separator />

          <div>
            <p className="mb-2 flex items-center gap-1 text-sm font-medium">
              Manual stock adjustment <TermHint term="adjustment" iconOnly />
            </p>
            <div className="flex items-center gap-2 mb-2">
              <Button type="button" variant="outline" size="icon" onClick={() => setAdjustDelta((d) => Math.max(1, d - 1))} aria-label="Decrease adjustment quantity">
                <Minus className="h-4 w-4" />
              </Button>
              <Input
                type="number"
                className="w-20 text-center"
                value={adjustDelta}
                onChange={(e) => setAdjustDelta(Math.max(1, Number(e.target.value) || 1))}
                aria-label="Adjustment quantity"
              />
              <Button type="button" variant="outline" size="icon" onClick={() => setAdjustDelta((d) => d + 1)} aria-label="Increase adjustment quantity">
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            <Label htmlFor="reason" className="text-xs text-muted-foreground">Reason (required)</Label>
            <Input id="reason" placeholder="e.g. Cycle count adjustment" value={reason} onChange={(e) => setReason(e.target.value)} className="mt-1" />
            <p className="mt-1 mb-2 text-xs text-muted-foreground">{MICROCOPY.reason}</p>
            <div className="flex gap-2">
              <Button type="button" size="sm" variant="outline" className="flex-1" onClick={() => handleAdjust(-1)} disabled={pendingSign !== null} loading={pendingSign === -1}>
                Remove stock
              </Button>
              <Button type="button" size="sm" className="flex-1" onClick={() => handleAdjust(1)} disabled={pendingSign !== null} loading={pendingSign === 1}>
                Add stock
              </Button>
            </div>
          </div>

          <Separator />

          <div className="space-y-4">
            <p className="flex items-center gap-1 text-sm font-medium">
              History <TermHint term="stockMovement" iconOnly />
            </p>

            <HistorySection
              label="Purchase history"
              emptyText="No purchases received yet."
              movements={purchaseHistory}
              primaryLabel={(m) => vendors.find((v) => v.id === m.vendorId)?.name ?? m.reason}
            />
            <HistorySection
              label="Sales history"
              emptyText="No sales recorded yet."
              movements={salesHistory}
              primaryLabel={(m) => {
                const patient = m.patientId ? patients.find((p) => p.id === m.patientId) : undefined
                const parts = [patient ? patientFullName(patient) : null, m.doctor].filter(Boolean)
                return parts.length > 0 ? parts.join(' · ') : m.reason
              }}
            />
            <HistorySection
              label="Loan history"
              emptyText="No loans recorded yet."
              movements={loanHistory}
              primaryLabel={(m) => labs.find((l) => l.id === m.labId)?.name ?? m.reason}
            />
            <HistorySection
              label="Adjustments"
              emptyText="No manual adjustments recorded yet."
              movements={adjustmentHistory}
              primaryLabel={(m) => m.reason}
            />
          </div>

          {clinicSettings.batchLotTrackingEnabled && (
            <>
              <Separator />
              <div>
                <p className="mb-2 flex items-center gap-1 text-sm font-medium">
                  Lot information <TermHint term="batchNumber" iconOnly />
                </p>
                <div className="space-y-2">
                  {lots.map((lot) => (
                    <div key={lot.lotNumber} className="flex items-center justify-between text-xs">
                      <div>
                        <p className="font-medium text-foreground">{lot.lotNumber}</p>
                        <p className="text-muted-foreground">{lot.expiryDate ? `Expires ${formatDate(lot.expiryDate)}` : 'No expiry recorded'}</p>
                      </div>
                      <span className="font-medium tabular-nums">{lot.remaining} remaining</span>
                    </div>
                  ))}
                  {lots.length === 0 && <p className="text-xs text-muted-foreground">No lots recorded yet for this product.</p>}
                </div>
              </div>
            </>
          )}
        </SheetBody>

        <SheetFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
        </SheetFooter>
      </SheetContent>

      <ProductFormDialog product={product} open={editOpen} onOpenChange={setEditOpen} />
    </Sheet>
  )
}
