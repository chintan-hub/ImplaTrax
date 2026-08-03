import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { Plus, Trash2 } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import { Combobox } from '@/components/ui/combobox'
import { PatientFormDialog } from '@/components/patients/PatientFormDialog'
import { PhotoDropzone } from '@/components/shared/PhotoDropzone'
import { useData } from '@/store/DataContext'
import { patientFullName } from '@/mocks/patients'
import { useCurrencyFormat } from '@/hooks/useCurrencyFormat'
import { productComboboxOptions } from '@/lib/productOptions'
import type { SaleLine } from '@/types'

export function SaleFormDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { patients, cases, products, createSale, clinicSettings } = useData()
  const { format } = useCurrencyFormat()
  const [patientId, setPatientId] = useState<string>('')
  const [caseId, setCaseId] = useState<string>('none')
  const [lines, setLines] = useState<SaleLine[]>([])
  const [photos, setPhotos] = useState<string[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [patientError, setPatientError] = useState(false)
  const [addingPatient, setAddingPatient] = useState(false)

  const patientOptions = useMemo(
    () => patients.map((p) => ({ value: p.id, label: `${patientFullName(p)} · ${p.patientCode}`, searchValue: `${patientFullName(p)} ${p.patientCode}` })),
    [patients],
  )
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

  // Mirrors POReceiveDialog's missingLot gate: whenever Batch/Lot Tracking
  // is on AND the line's product opts into it, the field this form already
  // shows is not just a suggestion — leaving it blank must block the sale,
  // the same as it already does at receiving (PROJECT.md's "ON ... enforce
  // lot behavior" rule, previously only enforced at PO receipt, not here).
  const needsBatchLot = (productId: string) => {
    const product = products.find((p) => p.id === productId)
    return Boolean(clinicSettings.batchLotTrackingEnabled && product?.batchTracked)
  }
  const missingBatchLot = lines.some((l) => needsBatchLot(l.productId) && !l.batchLot?.trim())

  const addLine = () => {
    const p = products[0]
    setLines((prev) => [...prev, { productId: p.id, quantity: 1, unitPrice: p.unitPrice }])
  }
  const updateLine = (i: number, patch: Partial<SaleLine>) => setLines((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l)))
  const removeLine = (i: number) => setLines((prev) => prev.filter((_, idx) => idx !== i))

  const reset = () => {
    setPatientId('')
    setCaseId('none')
    setLines([])
    setPhotos([])
    setPatientError(false)
  }

  const handlePatientChange = (v: string) => {
    setPatientId(v)
    setCaseId('none')
    setPatientError(false)
  }

  // Opened from the Combobox's always-visible "+ Add New Patient" row — the
  // sale's line items live in this component's own state, untouched by
  // whatever happens in the nested PatientFormDialog, so nothing entered so
  // far is lost while the user steps away to create the patient.
  const handlePatientCreated = (patient: { id: string }) => {
    handlePatientChange(patient.id)
  }

  const handleSubmit = async () => {
    if (!patientId) {
      setPatientError(true)
      toast.error('Patient is required to record a sale.')
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
    if (missingBatchLot) {
      toast.error('Enter a batch/lot number for every tracked line.')
      return
    }
    setSubmitting(true)
    try {
      const sale = await createSale(lines, patientId, caseId === 'none' ? undefined : caseId, photos.length > 0 ? photos : undefined)
      toast.success(`Sale ${sale.saleNumber} recorded`, { description: `${format(sale.total)} · stock updated` })
      reset()
      onOpenChange(false)
    } catch (err) {
      toast.error('Could not record sale', { description: err instanceof Error ? err.message : undefined })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v) }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Record Sale</DialogTitle>
          <DialogDescription>A sale marks products as permanently used in a patient. Stock is deducted immediately.</DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Patient *</Label>
            <Combobox
              options={patientOptions}
              value={patientId}
              onChange={handlePatientChange}
              placeholder="Search or select patient"
              searchPlaceholder="Search name or patient ID..."
              emptyText="No patients found."
              onCreate={() => setAddingPatient(true)}
              createLabel={() => '+ Add New Patient'}
              alwaysShowCreate
              triggerAriaLabel="Patient"
              className={patientError ? 'border-danger-500' : undefined}
            />
            {patientError && <p className="text-xs text-danger-600">Patient is required to record a sale.</p>}
          </div>
          <div className="space-y-1.5">
            <Label>Case (optional)</Label>
            <Select value={caseId} onValueChange={setCaseId} disabled={!patientId}>
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
                    <Combobox
                      className="flex-1"
                      options={productComboboxOptions(products, (p) => `${p.name} (${p.quantityOnHand} in stock)`)}
                      value={line.productId}
                      onChange={(v) => updateLine(i, { productId: v, unitPrice: products.find((p) => p.id === v)?.unitPrice ?? line.unitPrice, batchLot: undefined })}
                      placeholder="Select product"
                      searchPlaceholder="Search name, SKU, system, diameter..."
                      emptyText="No products found."
                      triggerAriaLabel="Product"
                    />
                    <div className="flex items-center gap-2">
                      <Input type="number" className="w-16" min={1} aria-label="Quantity" value={line.quantity} onChange={(e) => updateLine(i, { quantity: Math.max(1, Number(e.target.value) || 1) })} />
                      <Input type="number" className="w-24" step="0.01" aria-label="Unit price" value={line.unitPrice} onChange={(e) => updateLine(i, { unitPrice: Math.max(0, Number(e.target.value) || 0) })} />
                      <Button type="button" size="icon" variant="ghost" className="shrink-0" onClick={() => removeLine(i)} aria-label="Remove line item">
                        <Trash2 className="h-4 w-4 text-danger-600" />
                      </Button>
                    </div>
                  </div>
                  {clinicSettings.batchLotTrackingEnabled && product?.batchTracked && (
                    <>
                      <Input
                        className="mt-2"
                        placeholder="Batch / Lot number (required)"
                        aria-label="Batch / Lot number"
                        value={line.batchLot ?? ''}
                        onChange={(e) => updateLine(i, { batchLot: e.target.value || undefined })}
                      />
                      {!line.batchLot?.trim() && (
                        <p className="mt-1 text-xs text-danger-600">A batch/lot number is required for this line.</p>
                      )}
                    </>
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
            <p className="mt-2 text-right text-sm font-medium">Total: {format(total)}</p>
          )}
        </div>

        <PhotoDropzone
          label="Photos (Optional)"
          photos={photos}
          onChange={setPhotos}
          helpText="Record component condition or a clinical delivery slip."
        />

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>Cancel</Button>
          <Button onClick={handleSubmit} loading={submitting} disabled={hasStockIssue || missingBatchLot}>Record Sale</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <PatientFormDialog open={addingPatient} onOpenChange={setAddingPatient} onCreated={handlePatientCreated} />
    </>
  )
}
