import { useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { ArrowLeft, ClipboardList, MessageCircle, Printer, Camera, X } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { EmptyState } from '@/components/shared/EmptyState'
import { IconHelp } from '@/components/ui/help-tooltip'
import { POStatusActions } from '@/components/purchase-orders/POStatusActions'
import { useData } from '@/store/DataContext'
import { formatCurrency, formatDate, formatDateTime } from '@/lib/utils'
import { buildPOSummaryText, buildPurchaseOrderDocumentData } from '@/lib/documents/purchaseOrder'
import { PurchaseOrderDocument } from '@/lib/documents/PurchaseOrderDocument'

const MAX_PHOTO_BYTES = 5 * 1024 * 1024 // 5MB — a defensive cap for a client-only, in-memory data URL

export function PODetailPage() {
  const { poId } = useParams()
  const navigate = useNavigate()
  const { purchaseOrders, vendors, products, attachPhotoToOrder } = useData()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const po = purchaseOrders.find((p) => p.id === poId)

  if (!po) {
    return <EmptyState icon={ClipboardList} title="Purchase order not found" action={<Button onClick={() => navigate('/purchase-orders')}>Back to Purchase Orders</Button>} />
  }

  const vendor = vendors.find((v) => v.id === po.vendorId)
  const productById = new Map(products.map((p) => [p.id, p]))
  const totalCost = po.lines.reduce((sum, l) => sum + l.quantityOrdered * l.unitCost, 0)
  const history = [...po.history].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

  const handleCopyWhatsApp = async () => {
    const text = buildPOSummaryText(po, vendor, productById)
    try {
      await navigator.clipboard.writeText(text)
      toast.success('Copied to clipboard', { description: 'Paste it into WhatsApp to share this purchase order.' })
    } catch {
      toast.error('Could not access the clipboard in this browser.')
    }
  }

  const handlePrint = () => {
    const previousTitle = document.title
    document.title = po.poNumber
    const restoreTitle = () => {
      document.title = previousTitle
      window.removeEventListener('afterprint', restoreTitle)
    }
    window.addEventListener('afterprint', restoreTitle)
    window.print()
  }

  const handlePhotoSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (!file.type.startsWith('image/')) {
      toast.error('Please choose an image file.')
      return
    }
    if (file.size > MAX_PHOTO_BYTES) {
      toast.error('That image is too large (max 5MB).')
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      attachPhotoToOrder(po.id, reader.result as string)
      toast.success('Photo attached')
    }
    reader.onerror = () => toast.error('Could not read that image.')
    reader.readAsDataURL(file)
  }

  return (
    <div>
      <div className="print:hidden">
      <button onClick={() => navigate('/purchase-orders')} className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-3.5 w-3.5" /> Back to Purchase Orders
      </button>

      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight font-mono">
            {po.poNumber}
            <StatusBadge status={po.status} />
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">{vendor?.name ?? 'Unknown vendor'} · Expected {formatDate(po.eta)}</p>
        </div>
        <POStatusActions po={po} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Line Items</CardTitle>
              <CardDescription>{po.lines.length} product{po.lines.length !== 1 ? 's' : ''} on this order</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead className="text-right">Ordered</TableHead>
                    <TableHead className="text-right">Received</TableHead>
                    <TableHead className="text-right">Unit Cost</TableHead>
                    <TableHead className="text-right">Line Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {po.lines.map((line) => {
                    const product = productById.get(line.productId)
                    return (
                      <TableRow key={line.id}>
                        <TableCell>
                          <p className="font-medium">{product?.name ?? 'Unknown product'}</p>
                          <p className="text-xs text-muted-foreground">{product?.sku}</p>
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{line.quantityOrdered}</TableCell>
                        <TableCell className="text-right tabular-nums">
                          <Badge variant={line.quantityReceived >= line.quantityOrdered ? 'success' : line.quantityReceived > 0 ? 'warning' : 'secondary'}>
                            {line.quantityReceived} / {line.quantityOrdered}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{formatCurrency(line.unitCost)}</TableCell>
                        <TableCell className="text-right tabular-nums font-medium">{formatCurrency(line.quantityOrdered * line.unitCost)}</TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
              <Separator className="my-3" />
              <p className="text-right text-sm font-semibold">Total: {formatCurrency(totalCost)}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>History</CardTitle>
              <CardDescription>Complete audit trail for this purchase order — every entry is permanent</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="relative space-y-6 pl-6 before:absolute before:left-[7px] before:top-1 before:h-[calc(100%-8px)] before:w-px before:bg-border">
                {history.map((evt) => (
                  <div key={evt.id} className="relative">
                    <span className="absolute -left-6 top-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-primary ring-4 ring-primary/15" />
                    <p className="text-sm font-medium">{evt.label}</p>
                    <p className="mt-0.5 text-sm text-muted-foreground">{evt.description}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{formatDateTime(evt.date)} · {evt.actor}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Vendor & Dates</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div>
                <p className="text-muted-foreground">Vendor</p>
                <p className="font-medium">{vendor?.name ?? '—'}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Contact</p>
                <p className="font-medium">{vendor?.contactName ?? '—'}</p>
              </div>
              <Separator />
              <div>
                <p className="text-muted-foreground">Created</p>
                <p className="font-medium">{formatDate(po.createdAt)}</p>
              </div>
              {po.submittedAt && (
                <div>
                  <p className="text-muted-foreground">Submitted</p>
                  <p className="font-medium">{formatDate(po.submittedAt)}</p>
                </div>
              )}
              {po.confirmedAt && (
                <div>
                  <p className="text-muted-foreground">Confirmed</p>
                  <p className="font-medium">{formatDate(po.confirmedAt)}</p>
                </div>
              )}
              {po.receivedAt && (
                <div>
                  <p className="text-muted-foreground">Fully received</p>
                  <p className="font-medium">{formatDate(po.receivedAt)}</p>
                </div>
              )}
              {po.notes && (
                <>
                  <Separator />
                  <div>
                    <p className="text-muted-foreground">Notes</p>
                    <p className="mt-1 text-sm">{po.notes}</p>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Share & Export</CardTitle>
              <CardDescription>Send or save this purchase order</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <IconHelp helpKey="copyWhatsApp">
                  <Button variant="outline" size="sm" onClick={handleCopyWhatsApp}>
                    <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
                  </Button>
                </IconHelp>
                <IconHelp helpKey="printPO">
                  <Button variant="outline" size="sm" onClick={handlePrint}>
                    <Printer className="h-3.5 w-3.5" /> Print
                  </Button>
                </IconHelp>
              </div>

              <Separator />

              <div>
                <p className="mb-2 flex items-center gap-1 text-sm font-medium">
                  Reference photo <IconHelp helpKey="attachPhoto"><span className="text-xs text-muted-foreground cursor-help">(optional)</span></IconHelp>
                </p>
                {po.photoDataUrl ? (
                  <div className="relative">
                    <img src={po.photoDataUrl} alt="Purchase order reference" className="w-full rounded-lg border border-border object-cover" />
                    <Button
                      size="icon"
                      variant="outline"
                      className="absolute right-2 top-2 h-7 w-7 bg-background/90"
                      aria-label="Remove attached photo"
                      onClick={() => { attachPhotoToOrder(po.id, undefined); toast.success('Photo removed') }}
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ) : (
                  <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
                    <Camera className="h-3.5 w-3.5" /> Attach Photo
                  </Button>
                )}
                <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoSelected} />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
      </div>

      <div className="hidden print:block">
        <PurchaseOrderDocument data={buildPurchaseOrderDocumentData(po, vendor, productById)} />
      </div>
    </div>
  )
}
