import { useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { toast } from 'sonner'
import { ArrowLeft, Receipt, MessageCircle, Printer, Truck, Ban } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { EmptyState } from '@/components/shared/EmptyState'
import { useData } from '@/store/DataContext'
import { useAuth } from '@/features/auth/AuthContext'
import { patientFullName } from '@/mocks/patients'
import { formatDateTime, simulateLatency } from '@/lib/utils'
import { useCurrencyFormat } from '@/hooks/useCurrencyFormat'
import { buildSaleSummaryText, buildSaleDocumentData } from '@/lib/documents/sale'
import { SaleDocument } from '@/lib/documents/SaleDocument'
import { DeliveryChallanDocument } from '@/lib/documents/DeliveryChallanDocument'

function VoidSaleDialog({ open, onOpenChange, saleId, saleNumber }: { open: boolean; onOpenChange: (v: boolean) => void; saleId: string; saleNumber: string }) {
  const { voidSale } = useData()
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async () => {
    if (!reason.trim()) {
      toast.error('A reason is required to void a sale.')
      return
    }
    setSubmitting(true)
    await simulateLatency()
    try {
      voidSale(saleId, reason.trim())
      toast.success(`${saleNumber} voided`, { description: 'Stock has been restored.' })
      setReason('')
      onOpenChange(false)
    } catch (err) {
      toast.error('Could not void sale', { description: err instanceof Error ? err.message : undefined })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) setReason(''); onOpenChange(v) }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Void {saleNumber}?</DialogTitle>
          <DialogDescription>This restores the deducted stock for every line on this sale. The sale record stays visible for audit purposes, marked as voided.</DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label htmlFor="void-reason">Reason</Label>
          <Textarea id="void-reason" placeholder="e.g. Entered in error, patient declined implant" value={reason} onChange={(e) => setReason(e.target.value)} />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>Cancel</Button>
          <Button variant="destructive" onClick={handleSubmit} loading={submitting}>Void Sale</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

type PrintMode = 'invoice' | 'challan'

export function SaleDetailPage() {
  const { saleId } = useParams()
  const navigate = useNavigate()
  const { sales, patients, cases, products, clinicSettings } = useData()
  const { workspaceMembers } = useAuth()
  const { format } = useCurrencyFormat()

  const [printMode, setPrintMode] = useState<PrintMode>('invoice')
  const [voiding, setVoiding] = useState(false)

  const sale = sales.find((s) => s.id === saleId)

  if (!sale) {
    return <EmptyState icon={Receipt} title="Sale not found" action={<Button onClick={() => navigate('/sales')}>Back to Sales</Button>} />
  }

  const patient = sale.patientId ? patients.find((p) => p.id === sale.patientId) : undefined
  const caseRecord = sale.caseId ? cases.find((c) => c.id === sale.caseId) : undefined
  const soldBy = workspaceMembers.find((m) => m.id === sale.soldBy)
  const productById = new Map(products.map((p) => [p.id, p]))

  const handleCopyWhatsApp = async () => {
    const text = buildSaleSummaryText(sale, patient, caseRecord, productById, clinicSettings.currency)
    try {
      await navigator.clipboard.writeText(text)
      toast.success('Copied to clipboard', { description: 'Paste it into WhatsApp to share this sale.' })
    } catch {
      toast.error('Could not access the clipboard in this browser.')
    }
  }

  const handlePrint = (mode: PrintMode) => {
    setPrintMode(mode)
    const previousTitle = document.title
    document.title = mode === 'challan' ? `Delivery Challan ${sale.saleNumber}` : sale.saleNumber
    const restoreTitle = () => {
      document.title = previousTitle
      window.removeEventListener('afterprint', restoreTitle)
    }
    window.addEventListener('afterprint', restoreTitle)
    // The printable container renders whichever document matches printMode —
    // wait a tick for that state update to flush before the browser
    // snapshots the page for printing.
    requestAnimationFrame(() => window.print())
  }

  return (
    <div>
      <div className="print:hidden">
      <button onClick={() => navigate('/sales')} className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-3.5 w-3.5" /> Back to Sales
      </button>

      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight font-mono">
            {sale.saleNumber}
            {sale.voidedAt && <Badge variant="secondary">Voided</Badge>}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {patient ? patientFullName(patient) : 'Unknown patient'} · {formatDateTime(sale.createdAt)}
          </p>
        </div>
        <div>
          {!sale.voidedAt && (
            <Button variant="outline" size="sm" className="text-danger-700 dark:text-danger-500" onClick={() => setVoiding(true)}>
              <Ban className="h-3.5 w-3.5" /> Void Sale
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Line Items</CardTitle>
              <CardDescription>{sale.lines.length} product{sale.lines.length !== 1 ? 's' : ''} on this sale</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    {clinicSettings.batchLotTrackingEnabled && <TableHead>Batch / Lot</TableHead>}
                    <TableHead className="text-right">Quantity</TableHead>
                    <TableHead className="text-right">Unit Price</TableHead>
                    <TableHead className="text-right">Line Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sale.lines.map((line, i) => {
                    const product = products.find((p) => p.id === line.productId)
                    return (
                      <TableRow key={i}>
                        <TableCell>
                          <p className="font-medium">{product?.name ?? 'Unknown product'}</p>
                          <p className="text-xs text-muted-foreground">{product?.sku}</p>
                        </TableCell>
                        {clinicSettings.batchLotTrackingEnabled && <TableCell className="text-muted-foreground">{line.batchLot ?? '—'}</TableCell>}
                        <TableCell className="text-right tabular-nums">{line.quantity}</TableCell>
                        <TableCell className="text-right tabular-nums">{format(line.unitPrice)}</TableCell>
                        <TableCell className="text-right tabular-nums font-medium">{format(line.unitPrice * line.quantity)}</TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
              <Separator className="my-3" />
              <p className="text-right text-sm font-semibold">Total: {format(sale.total)}</p>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Sale Info</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div>
                <p className="text-muted-foreground">Patient</p>
                {patient ? (
                  <Link to={`/patients/${patient.id}`} className="font-medium text-primary hover:underline">
                    {patientFullName(patient)}
                  </Link>
                ) : <p className="font-medium text-muted-foreground">Unknown patient</p>}
              </div>
              <div>
                <p className="text-muted-foreground">Case</p>
                {caseRecord ? (
                  <Link to={`/cases/${caseRecord.id}`} className="font-medium text-primary hover:underline font-mono">
                    {caseRecord.caseId}
                  </Link>
                ) : <p className="font-medium text-muted-foreground">No case</p>}
              </div>
              <Separator />
              <div>
                <p className="text-muted-foreground">Sold By</p>
                <p className="font-medium">{soldBy?.name ?? 'Unknown'}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Date</p>
                <p className="font-medium">{formatDateTime(sale.createdAt)}</p>
              </div>
              <Separator />
              <div>
                <p className="text-muted-foreground">Total</p>
                <p className="font-medium">{format(sale.total)}</p>
              </div>
              {sale.voidedAt && (
                <>
                  <Separator />
                  <div>
                    <p className="text-danger-600 font-medium">Voided {formatDateTime(sale.voidedAt)}</p>
                    <p className="mt-0.5 text-muted-foreground">{sale.voidReason}</p>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Share & Export</CardTitle>
              <CardDescription>Send or save this sale</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-2">
                <Button variant="outline" size="sm" className="col-span-2" onClick={handleCopyWhatsApp}>
                  <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
                </Button>
                <Button variant="outline" size="sm" onClick={() => handlePrint('invoice')}>
                  <Printer className="h-3.5 w-3.5" /> Print Invoice
                </Button>
                <Button variant="outline" size="sm" onClick={() => handlePrint('challan')}>
                  <Truck className="h-3.5 w-3.5" /> Print Challan
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
      </div>

      <VoidSaleDialog open={voiding} onOpenChange={setVoiding} saleId={sale.id} saleNumber={sale.saleNumber} />

      <div className="hidden print:block">
        {printMode === 'challan' ? (
          <DeliveryChallanDocument data={buildSaleDocumentData(sale, patient, caseRecord, soldBy?.name ?? 'Unknown', productById, clinicSettings.batchLotTrackingEnabled)} />
        ) : (
          <SaleDocument data={buildSaleDocumentData(sale, patient, caseRecord, soldBy?.name ?? 'Unknown', productById, clinicSettings.batchLotTrackingEnabled)} />
        )}
      </div>
    </div>
  )
}
