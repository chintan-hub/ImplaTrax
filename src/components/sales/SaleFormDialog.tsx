import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Plus, Trash2 } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import { useData } from '@/store/DataContext'
import { patientFullName } from '@/mocks/patients'
import { formatCurrency, simulateLatency } from '@/lib/utils'
import type { SaleLine } from '@/types'

export function SaleFormDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { patients, cases, products, createSale } = useData()
  const [patientId, setPatientId] = useState<string>('none')
  const [caseId, setCaseId] = useState<string>('none')
  const [lines, setLines] = useState<SaleLine[]>([])
  const [submitting, setSubmitting] = useState(false)

  const patientCases = useMemo(() => cases.filter((c) => c.patientId === patientId), [cases, patientId])
  const total = lines.reduce((s, l) => s + l.unitPrice * l.quantity, 0)

  // A product can appear on more than one line, so availability is checked
  // against the combined quantity requested across all lines for that
  // product, not each line in isolation (mirrors the DataContext guard).
  const requestedByProduct = useMemo(() => {
    const m = new Map<string, number>()
    lines.forEach((l) => m.set(l.productId, (m.get(l.productId) ?? 0) + l.quantity))
    return m
  }, [lines])
  const stockIssue = (productId: string) => {
    const available = products.find((p) => p.id === productId)?.quantityOnHand ?? 0
    const requested = requestedByProduct.get(productId) ?? 0
    return requested > available ? { available, requested } : null
  }
  const hasStockIssue = lines.some((l) => stockIssue(l.productId) !== null)

  const addLine = () => {
    const p = products[0]
    setLines((prev) => [...prev, { productId: p.id, quantity: 1, unitPrice: p.unitPrice }])
  }
  const updateLine = (i: number, patch: Partial<SaleLine>) => setLines((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l)))
  const removeLine = (i: number) => setLines((prev) => prev.filter((_, idx) => idx !== i))

  const reset = () => {
    setPatientId('none')
    setCaseId('none')
    setLines([])
  }

  const handleSubmit = async () => {
    if (lines.length === 0) {
      toast.error('Add at least one product line.')
      return
    }
    if (hasStockIssue) {
      toast.error('One or more lines exceed available stock.')
      return
    }
    setSubmitting(true)
    await simulateLatency()
    const sale = createSale(lines, patientId === 'none' ? undefined : patientId, caseId === 'none' ? undefined : caseId)
    toast.success(`Sale ${sale.saleNumber} recorded`, { description: `${formatCurrency(sale.total)} · stock updated` })
    setSubmitting(false)
    reset()
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v) }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Record Sale</DialogTitle>
          <DialogDescription>A sale marks products as permanently used. Stock is deducted immediately.</DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Patient (optional)</Label>
            <Select value={patientId} onValueChange={(v) => { setPatientId(v); setCaseId('none') }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent className="max-h-72">
                <SelectItem value="none">Direct sale (no patient)</SelectItem>
                {patients.map((p) => <SelectItem key={p.id} value={p.id}>{patientFullName(p)}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Case (optional)</Label>
            <Select value={caseId} onValueChange={setCaseId} disabled={patientId === 'none'}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent className="max-h-72">
                <SelectItem value="none">No case</SelectItem>
                {patientCases.map((c) => <SelectItem key={c.id} value={c.id}>{c.caseId}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <Label>Line items</Label>
            <Button type="button" size="sm" variant="outline" onClick={addLine}>
              <Plus className="h-3.5 w-3.5" /> Add line
            </Button>
          </div>
          <div className="space-y-2 max-h-64 overflow-y-auto scrollbar-thin">
            {lines.map((line, i) => {
              const issue = stockIssue(line.productId)
              const product = products.find((p) => p.id === line.productId)
              return (
                <div key={i} className="rounded-lg border border-border p-2">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <Select
                      value={line.productId}
                      onValueChange={(v) => updateLine(i, { productId: v, unitPrice: products.find((p) => p.id === v)?.unitPrice ?? line.unitPrice, batchLot: undefined })}
                    >
                      <SelectTrigger className="flex-1"><SelectValue /></SelectTrigger>
                      <SelectContent className="max-h-72">
                        {products.map((p) => <SelectItem key={p.id} value={p.id}>{p.name} ({p.quantityOnHand} in stock)</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <div className="flex items-center gap-2">
                      <Input type="number" className="w-16" min={1} aria-label="Quantity" value={line.quantity} onChange={(e) => updateLine(i, { quantity: Math.max(1, Number(e.target.value) || 1) })} />
                      <Input type="number" className="w-24" step="0.01" aria-label="Unit price" value={line.unitPrice} onChange={(e) => updateLine(i, { unitPrice: Math.max(0, Number(e.target.value) || 0) })} />
                      <Button type="button" size="icon" variant="ghost" className="shrink-0" onClick={() => removeLine(i)} aria-label="Remove line item">
                        <Trash2 className="h-4 w-4 text-danger-600" />
                      </Button>
                    </div>
                  </div>
                  {product?.batchTracked && (
                    <Input
                      className="mt-2"
                      placeholder="Batch / Lot number (e.g. LOT-12345)"
                      aria-label="Batch / Lot number"
                      value={line.batchLot ?? ''}
                      onChange={(e) => updateLine(i, { batchLot: e.target.value || undefined })}
                    />
                  )}
                  {issue && (
                    <p className="mt-1.5 text-xs text-danger-600">Only {issue.available} in stock — {issue.requested} requested.</p>
                  )}
                </div>
              )
            })}
            {lines.length === 0 && <p className="text-sm text-muted-foreground">No products added yet.</p>}
          </div>
          {lines.length > 0 && (
            <p className="mt-2 text-right text-sm font-medium">Total: {formatCurrency(total)}</p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>Cancel</Button>
          <Button onClick={handleSubmit} loading={submitting} disabled={hasStockIssue}>Record Sale</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
