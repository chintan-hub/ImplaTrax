import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useData } from '@/store/DataContext'
import { MICROCOPY } from '@/content/helpText'
import { simulateLatency } from '@/lib/utils'
import type { Loan } from '@/types'

interface LineState {
  quantityReturned: number
  quantityLost: number
  lostReason: string
}

export function LoanReturnDialog({ loan, open, onOpenChange }: { loan: Loan | null; open: boolean; onOpenChange: (v: boolean) => void }) {
  const { products, returnLoanLines, clinicSettings } = useData()
  const [state, setState] = useState<Record<string, LineState>>({})
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (loan) {
      const initial: Record<string, LineState> = {}
      loan.lines.forEach((l) => {
        initial[l.id] = { quantityReturned: Math.max(0, l.quantityLoaned - l.quantityReturned - l.quantityLost), quantityLost: 0, lostReason: '' }
      })
      setState(initial)
    }
  }, [loan])

  if (!loan) return null

  const handleSubmit = async () => {
    const anyLostWithoutReason = loan.lines.some((l) => {
      const s = state[l.id]
      return s && s.quantityLost > 0 && !s.lostReason.trim()
    })
    if (anyLostWithoutReason) {
      toast.error('A reason is required for any lost components.')
      return
    }
    const returns = loan.lines
      .map((l) => {
        const s = state[l.id]
        if (!s || (s.quantityReturned === 0 && s.quantityLost === 0)) return null
        return { lineId: l.id, quantityReturned: s.quantityReturned, quantityLost: s.quantityLost, lostReason: s.lostReason || undefined }
      })
      .filter(Boolean) as { lineId: string; quantityReturned: number; quantityLost: number; lostReason?: string }[]

    if (returns.length === 0) {
      toast.error('Enter a returned or lost quantity for at least one item.')
      return
    }
    setSubmitting(true)
    await simulateLatency()
    returnLoanLines(loan.id, returns)
    toast.success(`Loan ${loan.loanNumber} updated`, { description: 'Stock and history have been updated.' })
    setSubmitting(false)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Process Return — {loan.loanNumber}</DialogTitle>
          <DialogDescription>Record what was returned. Partial returns are supported; lost items require a reason and reduce stock.</DialogDescription>
        </DialogHeader>

        <div className="space-y-3 max-h-96 overflow-y-auto scrollbar-thin">
          {loan.lines.map((line) => {
            const product = products.find((p) => p.id === line.productId)
            const outstanding = line.quantityLoaned - line.quantityReturned - line.quantityLost
            const s = state[line.id]
            if (outstanding <= 0) return null
            return (
              <div key={line.id} className="rounded-lg border border-border p-3">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <p className="text-sm font-medium">{product?.name}</p>
                    {clinicSettings.batchLotTrackingEnabled && line.batchLot && <p className="text-xs text-muted-foreground">Lot: {line.batchLot}</p>}
                  </div>
                  <span className="text-xs text-muted-foreground">Outstanding: {outstanding}</span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs text-muted-foreground">Returned</Label>
                    <Input
                      type="number"
                      min={0}
                      max={outstanding}
                      value={s?.quantityReturned ?? 0}
                      onChange={(e) => {
                        const v = Math.max(0, Math.min(outstanding - (s?.quantityLost ?? 0), Number(e.target.value) || 0))
                        setState((prev) => ({ ...prev, [line.id]: { ...prev[line.id], quantityReturned: v } }))
                      }}
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Lost</Label>
                    <Input
                      type="number"
                      min={0}
                      max={outstanding}
                      value={s?.quantityLost ?? 0}
                      onChange={(e) => {
                        const v = Math.max(0, Math.min(outstanding - (s?.quantityReturned ?? 0), Number(e.target.value) || 0))
                        setState((prev) => ({ ...prev, [line.id]: { ...prev[line.id], quantityLost: v } }))
                      }}
                    />
                  </div>
                </div>
                {(s?.quantityLost ?? 0) > 0 && (
                  <div className="mt-2">
                    <Label className="text-xs text-muted-foreground">Reason for loss (required)</Label>
                    <Input
                      placeholder="e.g. Component dropped and contaminated"
                      value={s?.lostReason ?? ''}
                      onChange={(e) => setState((prev) => ({ ...prev, [line.id]: { ...prev[line.id], lostReason: e.target.value } }))}
                    />
                    <p className="mt-1 text-xs text-muted-foreground">{MICROCOPY.lostReason}</p>
                  </div>
                )}
              </div>
            )
          })}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>Cancel</Button>
          <Button onClick={handleSubmit} loading={submitting}>Save Return</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
