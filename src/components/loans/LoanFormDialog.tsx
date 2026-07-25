import { useState } from 'react'
import { toast } from 'sonner'
import { Plus, Trash2 } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import { useData } from '@/store/DataContext'
import { MICROCOPY } from '@/content/helpText'
import { simulateLatency } from '@/lib/utils'

interface Line {
  productId: string
  quantityLoaned: number
}

export function LoanFormDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { labs, products, createLoan } = useData()
  const [labId, setLabId] = useState('')
  const [dueDate, setDueDate] = useState(() => new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10))
  const [notes, setNotes] = useState('')
  const [lines, setLines] = useState<Line[]>([])
  const [submitting, setSubmitting] = useState(false)

  const addLine = () => setLines((prev) => [...prev, { productId: products[0].id, quantityLoaned: 1 }])
  const updateLine = (i: number, patch: Partial<Line>) => setLines((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l)))
  const removeLine = (i: number) => setLines((prev) => prev.filter((_, idx) => idx !== i))

  const reset = () => {
    setLabId('')
    setLines([])
    setNotes('')
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
    setSubmitting(true)
    await simulateLatency()
    const loan = createLoan(labId, lines, new Date(dueDate).toISOString(), notes || undefined)
    toast.success(`Loan ${loan.loanNumber} issued`, { description: 'Stock has been deducted for the loaned products.' })
    setSubmitting(false)
    reset()
    onOpenChange(false)
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
            {lines.map((line, i) => (
              <div key={i} className="flex flex-col gap-2 rounded-lg border border-border p-2 sm:flex-row sm:items-center">
                <Select value={line.productId} onValueChange={(v) => updateLine(i, { productId: v })}>
                  <SelectTrigger className="flex-1"><SelectValue /></SelectTrigger>
                  <SelectContent className="max-h-72">
                    {products.map((p) => <SelectItem key={p.id} value={p.id}>{p.name} ({p.quantityOnHand} in stock)</SelectItem>)}
                  </SelectContent>
                </Select>
                <div className="flex items-center gap-2">
                  <Input type="number" className="w-20" min={1} aria-label="Quantity" value={line.quantityLoaned} onChange={(e) => updateLine(i, { quantityLoaned: Math.max(1, Number(e.target.value) || 1) })} />
                  <Button type="button" size="icon" variant="ghost" className="shrink-0" onClick={() => removeLine(i)} aria-label="Remove product from loan">
                    <Trash2 className="h-4 w-4 text-danger-600" />
                  </Button>
                </div>
              </div>
            ))}
            {lines.length === 0 && <p className="text-sm text-muted-foreground">No products added yet.</p>}
          </div>
        </div>

        <div className="space-y-1.5">
          <Label>Notes</Label>
          <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Optional notes about this loan..." />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>Cancel</Button>
          <Button onClick={handleSubmit} loading={submitting}>Issue Loan</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
