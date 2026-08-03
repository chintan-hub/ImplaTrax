import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Plus, Trash2 } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import { Combobox } from '@/components/ui/combobox'
import { PhotoDropzone } from '@/components/shared/PhotoDropzone'
import { useData } from '@/store/DataContext'
import { MICROCOPY } from '@/content/helpText'
import { productComboboxOptions } from '@/lib/productOptions'

interface Line {
  productId: string
  quantityLoaned: number
  batchLot?: string
}

export function LoanFormDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { labs, products, createLoan, clinicSettings } = useData()
  const [labId, setLabId] = useState('')
  const [dueDate, setDueDate] = useState(() => new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10))
  const [notes, setNotes] = useState('')
  const [lines, setLines] = useState<Line[]>([])
  const [photos, setPhotos] = useState<string[]>([])
  const [submitting, setSubmitting] = useState(false)

  const addLine = () => setLines((prev) => [...prev, { productId: products[0].id, quantityLoaned: 1 }])
  const updateLine = (i: number, patch: Partial<Line>) => setLines((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l)))
  const removeLine = (i: number) => setLines((prev) => prev.filter((_, idx) => idx !== i))

  // A product can appear on more than one line, so availability is checked
  // against the combined quantity requested across all lines for that
  // product, not each line in isolation (mirrors the DataContext guard).
  const requestedByProduct = useMemo(() => {
    const m = new Map<string, number>()
    lines.forEach((l) => m.set(l.productId, (m.get(l.productId) ?? 0) + l.quantityLoaned))
    return m
  }, [lines])
  const stockIssue = (productId: string) => {
    const available = products.find((p) => p.id === productId)?.quantityOnHand ?? 0
    const requested = requestedByProduct.get(productId) ?? 0
    return requested > available ? { available, requested } : null
  }
  const hasStockIssue = lines.some((l) => stockIssue(l.productId) !== null)
  // Batch-tracked products require a lot number at issuance — traceability
  // begins at receiving and stays intact through every stage of the loan.
  const hasLotIssue = clinicSettings.batchLotTrackingEnabled && lines.some((l) => products.find((p) => p.id === l.productId)?.batchTracked && !l.batchLot?.trim())

  const reset = () => {
    setLabId('')
    setLines([])
    setNotes('')
    setPhotos([])
  }

  const handleSubmit = async () => {
    if (!labId) {
      toast.error('Loans are only issued to labs — select a lab.')
      return
    }
    if (lines.length === 0) {
      toast.error('Add at least one product line.')
      return
    }
    if (hasStockIssue) {
      toast.error('One or more lines exceed available stock.')
      return
    }
    if (hasLotIssue) {
      toast.error('Enter a lot/batch number for every batch-tracked line.')
      return
    }
    setSubmitting(true)
    try {
      const loan = await createLoan(labId, lines, new Date(dueDate).toISOString(), notes || undefined, photos.length > 0 ? photos : undefined)
      toast.success(`Loan ${loan.loanNumber} issued`, { description: 'Stock has been deducted for the loaned products.' })
      reset()
      onOpenChange(false)
    } catch (err) {
      toast.error('Could not issue loan', { description: err instanceof Error ? err.message : undefined })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v) }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Issue New Loan</DialogTitle>
          <DialogDescription>Loans can only be issued to labs and may contain multiple products.</DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Lab</Label>
            <Select value={labId} onValueChange={setLabId}>
              <SelectTrigger><SelectValue placeholder="Select lab" /></SelectTrigger>
              <SelectContent className="max-h-72">
                {labs.map((l) => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Due date</Label>
            <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            <p className="text-xs text-muted-foreground">{MICROCOPY.dueDate}</p>
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <Label>Products on loan</Label>
            <Button type="button" size="sm" variant="outline" onClick={addLine}>
              <Plus className="h-3.5 w-3.5" /> Add product
            </Button>
          </div>
          <div className="space-y-2 max-h-56 overflow-y-auto scrollbar-thin">
            {lines.map((line, i) => {
              const issue = stockIssue(line.productId)
              const product = products.find((p) => p.id === line.productId)
              return (
                <div key={i} className="rounded-lg border border-border p-2">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <Combobox
                      className="flex-1"
                      options={productComboboxOptions(products, (p) => `${p.name} (${p.quantityOnHand} in stock)`)}
                      value={line.productId}
                      onChange={(v) => updateLine(i, { productId: v, batchLot: undefined })}
                      placeholder="Select product"
                      searchPlaceholder="Search name, SKU, system, diameter..."
                      emptyText="No products found."
                      triggerAriaLabel="Product"
                    />
                    <div className="flex items-center gap-2">
                      <Input type="number" className="w-20" min={1} aria-label="Quantity" value={line.quantityLoaned} onChange={(e) => updateLine(i, { quantityLoaned: Math.max(1, Number(e.target.value) || 1) })} />
                      <Button type="button" size="icon" variant="ghost" className="shrink-0" onClick={() => removeLine(i)} aria-label="Remove product from loan">
                        <Trash2 className="h-4 w-4 text-danger-600" />
                      </Button>
                    </div>
                  </div>
                  {clinicSettings.batchLotTrackingEnabled && product?.batchTracked && (
                    <div className="mt-2">
                      <Input
                        placeholder="Batch / Lot number (required)"
                        aria-label="Batch / Lot number"
                        value={line.batchLot ?? ''}
                        onChange={(e) => updateLine(i, { batchLot: e.target.value || undefined })}
                      />
                      <p className="mt-1 text-xs text-muted-foreground">{MICROCOPY.loanLot}</p>
                    </div>
                  )}
                  {issue && (
                    <p className="mt-1.5 text-xs text-danger-600">Only {issue.available} in stock — {issue.requested} requested.</p>
                  )}
                </div>
              )
            })}
            {lines.length === 0 && <p className="text-sm text-muted-foreground">No products added yet.</p>}
          </div>
        </div>

        <div className="space-y-1.5">
          <Label>Notes</Label>
          <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional notes about this loan..." />
        </div>

        <PhotoDropzone
          label="Photos (Optional)"
          photos={photos}
          onChange={setPhotos}
          helpText="Record component condition or a clinical delivery slip."
        />

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>Cancel</Button>
          <Button onClick={handleSubmit} loading={submitting} disabled={hasStockIssue || hasLotIssue}>Issue Loan</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
