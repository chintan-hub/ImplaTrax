import { useParams, useNavigate, Link } from 'react-router-dom'
import { ArrowLeft, CheckCircle2, FolderKanban } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { EmptyState } from '@/components/shared/EmptyState'
import { TermHint } from '@/components/ui/help-tooltip'
import { useData } from '@/store/DataContext'
import { patientFullName } from '@/mocks/patients'
import { caseTimelines } from '@/mocks/cases'
import { formatDate, formatDateTime } from '@/lib/utils'

export function CaseDetailPage() {
  const { caseId } = useParams()
  const navigate = useNavigate()
  const { cases, patients, labs, products } = useData()

  const caseRecord = cases.find((c) => c.id === caseId)

  if (!caseRecord) {
    return <EmptyState icon={FolderKanban} title="Case not found" action={<Button onClick={() => navigate('/cases')}>Back to Cases</Button>} />
  }

  const patient = patients.find((p) => p.id === caseRecord.patientId)
  const lab = caseRecord.labId ? labs.find((l) => l.id === caseRecord.labId) : undefined
  const timeline = caseTimelines[caseRecord.id] ?? [
    { id: 'evt_new', caseId: caseRecord.id, label: 'Case Opened', description: 'Treatment plan created and case opened for patient.', date: caseRecord.createdAt, actor: caseRecord.doctor },
  ]

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
        <StatusBadge status={caseRecord.status} />
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
                {timeline.map((evt) => (
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
            <CardHeader>
              <CardTitle>Implants Used</CardTitle>
              <CardDescription>Products placed as part of this case</CardDescription>
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
    </div>
  )
}
