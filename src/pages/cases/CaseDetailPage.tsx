import { useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { toast } from 'sonner'
import { ArrowLeft, ArrowRight, XCircle, Plus, CheckCircle2, FolderKanban } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { EmptyState } from '@/components/shared/EmptyState'
import { TermHint } from '@/components/ui/help-tooltip'
import { useData } from '@/store/DataContext'
import { patientFullName } from '@/mocks/patients'
import { nextCaseStatuses } from '@/lib/caseWorkflow'
import { formatDate, formatDateTime, simulateLatency } from '@/lib/utils'
import type { CaseImplantUsage, CaseStatus } from '@/types'

const STATUS_LABEL: Record<CaseStatus, string> = {
  planning: 'Planning',
  'surgery-scheduled': 'Surgery Scheduled',
  'in-progress': 'In Progress',
  restoration: 'Restoration',
  completed: 'Completed',
  cancelled: 'Cancelled',
}

function AddImplantDialog({ caseId, open, onOpenChange }: { caseId: string; open: boolean; onOpenChange: (v: boolean) => void }) {
  const { products, addImplantToCase } = useData()
  const [productId, setProductId] = useState(products[0]?.id ?? '')
  const [tooth, setTooth] = useState('')
  const [quantity, setQuantity] = useState(1)
  const [batchLot, setBatchLot] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const product = products.find((p) => p.id === productId)

  const reset = () => {
    setProductId(products[0]?.id ?? '')
    setTooth('')
    setQuantity(1)
    setBatchLot('')
  }

  const handleSubmit = async () => {
    if (!tooth.trim()) {
      toast.error('Enter a tooth number.')
      return
    }
    setSubmitting(true)
    await simulateLatency()
    const usage: CaseImplantUsage = { productId, tooth: tooth.trim(), quantity, batchLot: product?.batchTracked && batchLot.trim() ? batchLot.trim() : undefined }
    addImplantToCase(caseId, usage)
    toast.success('Implant added to case')
    setSubmitting(false)
    reset()
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v) }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Implant</DialogTitle>
          <DialogDescription>Record a product used in this case.</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="col-span-1 space-y-1.5 sm:col-span-2">
            <Label>Product</Label>
            <Select value={productId} onValueChange={setProductId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent className="max-h-72">
                {products.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="implant-tooth">Tooth (FDI)</Label>
            <Input id="implant-tooth" placeholder="e.g. 36" value={tooth} onChange={(e) => setTooth(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="implant-qty">Quantity</Label>
            <Input id="implant-qty" type="number" min={1} value={quantity} onChange={(e) => setQuantity(Math.max(1, Number(e.target.value) || 1))} />
          </div>
          {product?.batchTracked && (
            <div className="col-span-1 space-y-1.5 sm:col-span-2">
              <Label htmlFor="implant-lot">Batch / Lot number</Label>
              <Input id="implant-lot" placeholder="e.g. LOT-12345" value={batchLot} onChange={(e) => setBatchLot(e.target.value)} />
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>Cancel</Button>
          <Button onClick={handleSubmit} loading={submitting}>Add Implant</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function CaseDetailPage() {
  const { caseId } = useParams()
  const navigate = useNavigate()
  const { cases, patients, labs, products, advanceCaseStatus } = useData()
  const [addingImplant, setAddingImplant] = useState(false)
  const [confirmingStatus, setConfirmingStatus] = useState<CaseStatus | null>(null)
  const [cancelling, setCancelling] = useState(false)

  const caseRecord = cases.find((c) => c.id === caseId)

  if (!caseRecord) {
    return <EmptyState icon={FolderKanban} title="Case not found" action={<Button onClick={() => navigate('/cases')}>Back to Cases</Button>} />
  }

  const patient = patients.find((p) => p.id === caseRecord.patientId)
  const lab = caseRecord.labId ? labs.find((l) => l.id === caseRecord.labId) : undefined
  const history = [...caseRecord.history].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
  const nextStatuses = nextCaseStatuses(caseRecord.status)
  const nextForwardStatus = nextStatuses.find((s) => s !== 'cancelled')
  const canCancel = nextStatuses.includes('cancelled')

  const handleAdvance = (status: CaseStatus) => {
    advanceCaseStatus(caseRecord.id, status)
    toast.success(`Case advanced to ${STATUS_LABEL[status]}`)
  }

  const handleCancel = () => {
    advanceCaseStatus(caseRecord.id, 'cancelled')
    toast.success('Case cancelled')
  }

  return (
    <div>
      <button onClick={() => navigate('/cases')} className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-3.5 w-3.5" /> Back to Cases
      </button>

      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-1.5 text-2xl font-semibold tracking-tight font-mono">
            {caseRecord.caseId}
            <TermHint term="caseId" iconOnly className="font-sans" />
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">{caseRecord.procedure}</p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <StatusBadge status={caseRecord.status} />
          {nextForwardStatus && (
            <Button size="sm" onClick={() => setConfirmingStatus(nextForwardStatus)}>
              <ArrowRight className="h-3.5 w-3.5" /> Advance to {STATUS_LABEL[nextForwardStatus]}
            </Button>
          )}
          {canCancel && (
            <Button size="sm" variant="ghost" className="text-danger-600 hover:text-danger-700 hover:bg-danger/10" onClick={() => setCancelling(true)}>
              <XCircle className="h-3.5 w-3.5" /> Cancel Case
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Timeline</CardTitle>
              <CardDescription>Chronological history of this case</CardDescription>
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

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <div>
                <CardTitle>Implants Used</CardTitle>
                <CardDescription>Products placed as part of this case</CardDescription>
              </div>
              <Button size="sm" variant="outline" onClick={() => setAddingImplant(true)}>
                <Plus className="h-3.5 w-3.5" /> Add Implant
              </Button>
            </CardHeader>
            <CardContent className="space-y-2">
              {caseRecord.implants.length === 0 && <p className="text-sm text-muted-foreground">No implants recorded yet for this case.</p>}
              {caseRecord.implants.map((usage, i) => {
                const product = products.find((p) => p.id === usage.productId)
                return (
                  <div key={i} className="flex items-center justify-between rounded-lg border border-border p-3 text-sm">
                    <div>
                      <p className="font-medium">{product?.name}</p>
                      <p className="text-xs text-muted-foreground">Tooth #{usage.tooth} {usage.batchLot && `· Lot ${usage.batchLot}`}</p>
                    </div>
                    <Badge variant="outline">Qty {usage.quantity}</Badge>
                  </div>
                )
              })}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Case Info</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div>
                <p className="text-muted-foreground">Patient</p>
                {patient ? (
                  <Link to={`/patients/${patient.id}`} className="font-medium text-primary hover:underline">
                    {patientFullName(patient)}
                  </Link>
                ) : '—'}
              </div>
              <div>
                <p className="text-muted-foreground">Doctor</p>
                <p className="font-medium">{caseRecord.doctor}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Lab</p>
                {lab ? (
                  <Link to={`/labs/${lab.id}`} className="font-medium text-primary hover:underline">{lab.name}</Link>
                ) : <p className="font-medium text-muted-foreground">No lab assigned</p>}
              </div>
              <Separator />
              <div>
                <p className="text-muted-foreground">Created</p>
                <p className="font-medium">{formatDate(caseRecord.createdAt)}</p>
              </div>
              {caseRecord.scheduledDate && (
                <div>
                  <p className="text-muted-foreground">Scheduled</p>
                  <p className="font-medium">{formatDate(caseRecord.scheduledDate)}</p>
                </div>
              )}
              {caseRecord.completedDate && (
                <div className="flex items-center gap-1.5 text-success-600">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  <p className="font-medium">Completed {formatDate(caseRecord.completedDate)}</p>
                </div>
              )}
              {caseRecord.notes && (
                <>
                  <Separator />
                  <div>
                    <p className="text-muted-foreground">Notes</p>
                    <p className="mt-1 text-sm">{caseRecord.notes}</p>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <AddImplantDialog caseId={caseRecord.id} open={addingImplant} onOpenChange={setAddingImplant} />

      <ConfirmDialog
        open={confirmingStatus !== null}
        onOpenChange={(v) => { if (!v) setConfirmingStatus(null) }}
        title={confirmingStatus ? `Advance case to ${STATUS_LABEL[confirmingStatus]}?` : ''}
        description={`This records a new timeline event and moves the case status to ${confirmingStatus ? STATUS_LABEL[confirmingStatus] : ''}.`}
        confirmLabel="Advance"
        onConfirm={() => { if (confirmingStatus) handleAdvance(confirmingStatus) }}
      />

      <ConfirmDialog
        open={cancelling}
        onOpenChange={setCancelling}
        title={`Cancel ${caseRecord.caseId}?`}
        description="This case will be marked cancelled and its status can no longer be advanced. This cannot be undone."
        confirmLabel="Cancel Case"
        cancelLabel="Keep Case"
        tone="destructive"
        onConfirm={handleCancel}
      />
    </div>
  )
}
