import { useMemo } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { ArrowLeft, Star, Clock, Mail, Phone, MapPin, FlaskConical } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { StatCard } from '@/components/shared/StatCard'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { EmptyState } from '@/components/shared/EmptyState'
import { useData } from '@/store/DataContext'
import { formatDate } from '@/lib/utils'
import { openLoanValue } from '@/mocks/loans'
import { patientFullName } from '@/mocks/patients'
import { HandCoins, FolderKanban } from 'lucide-react'

export function LabDetailPage() {
  const { labId } = useParams()
  const navigate = useNavigate()
  const { labs, loans, cases, patients } = useData()

  const lab = labs.find((l) => l.id === labId)
  const labLoans = useMemo(() => loans.filter((l) => l.labId === labId).sort((a, b) => new Date(b.issuedAt).getTime() - new Date(a.issuedAt).getTime()), [loans, labId])
  const labCases = useMemo(
    () => cases.filter((c) => c.labId === labId).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [cases, labId],
  )
  const patientById = useMemo(() => new Map(patients.map((p) => [p.id, p])), [patients])

  if (!lab) {
    return <EmptyState icon={FlaskConical} title="Lab not found" action={<Button onClick={() => navigate('/labs')}>Back to Labs</Button>} />
  }

  const openLoans = labLoans.filter((l) => l.status !== 'closed')
  const outstandingItems = openLoans.reduce((sum, l) => sum + openLoanValue(l), 0)

  return (
    <div>
      <button onClick={() => navigate('/labs')} className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-3.5 w-3.5" /> Back to Labs
      </button>

      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{lab.name}</h1>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {lab.specialties.map((s) => <Badge key={s} variant="outline">{s}</Badge>)}
          </div>
        </div>
        <span className="flex items-center gap-1 text-lg font-semibold">
          <Star className="h-4 w-4 fill-warning-500 text-warning-500" /> {lab.rating.toFixed(1)}
        </span>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 mb-6">
        <StatCard label="Outstanding Loan Items" value={String(outstandingItems)} icon={HandCoins} tone="warning" helpTerm="loan" />
        <StatCard label="Avg Turnaround" value={`${lab.turnaroundDays}d`} icon={Clock} />
        <StatCard label="Cases Involving Lab" value={String(labCases.length)} icon={FolderKanban} tone="accent" />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-1 h-fit">
          <CardHeader>
            <CardTitle>Contact</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p className="font-medium">{lab.contactName}</p>
            <p className="flex items-center gap-2 text-muted-foreground"><Mail className="h-3.5 w-3.5" /> {lab.email}</p>
            <p className="flex items-center gap-2 text-muted-foreground"><Phone className="h-3.5 w-3.5" /> {lab.phone}</p>
            <p className="flex items-center gap-2 text-muted-foreground"><MapPin className="h-3.5 w-3.5" /> {lab.address}</p>
            <p className="text-xs text-muted-foreground pt-2 border-t border-border">Partner since {formatDate(lab.createdAt)}</p>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Loan History</CardTitle>
            <CardDescription>All loans issued to this lab</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {labLoans.length === 0 && <p className="text-sm text-muted-foreground">No loans issued to this lab yet.</p>}
            {labLoans.map((loan) => (
              <Link
                key={loan.id}
                to={`/loans/${loan.id}`}
                className="flex items-center justify-between rounded-lg border border-border p-3 text-sm hover:bg-surface-hover transition-colors"
              >
                <div>
                  <p className="font-medium">{loan.loanNumber}</p>
                  <p className="text-xs text-muted-foreground">{loan.lines.length} line item(s) · Issued {formatDate(loan.issuedAt)}</p>
                </div>
                <StatusBadge status={loan.status} />
              </Link>
            ))}
          </CardContent>
        </Card>

        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle>Cases Involving This Lab</CardTitle>
            <CardDescription>Every patient case that has used this lab</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {labCases.length === 0 && <p className="text-sm text-muted-foreground">No cases involve this lab yet.</p>}
            {labCases.map((c) => {
              const patient = patientById.get(c.patientId)
              return (
                <Link
                  key={c.id}
                  to={`/cases/${c.id}`}
                  className="flex items-center justify-between rounded-lg border border-border p-3 text-sm hover:bg-surface-hover transition-colors"
                >
                  <div>
                    <p className="font-medium font-mono text-xs">{c.caseId}</p>
                    <p className="text-xs text-muted-foreground">
                      {c.procedure} · {patient ? patientFullName(patient) : 'Unknown patient'} · {formatDate(c.createdAt)}
                    </p>
                  </div>
                  <StatusBadge status={c.status} />
                </Link>
              )
            })}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
