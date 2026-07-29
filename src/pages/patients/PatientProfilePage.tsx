import { useMemo, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { ArrowLeft, Phone, Mail, Calendar, Stethoscope, Plus, Pencil } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { EmptyState } from '@/components/shared/EmptyState'
import { PatientFormDialog } from '@/components/patients/PatientFormDialog'
import { useData } from '@/store/DataContext'
import { patientFullName } from '@/mocks/patients'
import { formatCurrency, formatDate, initials } from '@/lib/utils'
import { FolderKanban } from 'lucide-react'

export function PatientProfilePage() {
  const { patientId } = useParams()
  const navigate = useNavigate()
  const { patients, cases, sales } = useData()
  const [editOpen, setEditOpen] = useState(false)

  const patient = patients.find((p) => p.id === patientId)
  const patientCases = useMemo(() => cases.filter((c) => c.patientId === patientId), [cases, patientId])
  const patientSales = useMemo(() => sales.filter((s) => s.patientId === patientId), [sales, patientId])

  if (!patient) {
    return (
      <EmptyState icon={FolderKanban} title="Patient not found" action={<Button onClick={() => navigate('/patients')}>Back to Patients</Button>} />
    )
  }

  const age = Math.floor((Date.now() - new Date(patient.dob).getTime()) / (365.25 * 24 * 3600 * 1000))

  return (
    <div>
      <button onClick={() => navigate('/patients')} className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-3.5 w-3.5" /> Back to Patients
      </button>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-1 h-fit">
          <CardContent className="p-6">
            <div className="flex flex-col items-center text-center">
              <Avatar className="h-16 w-16">
                <AvatarFallback className="text-lg">{initials(patientFullName(patient))}</AvatarFallback>
              </Avatar>
              <p className="mt-3 text-lg font-semibold">{patientFullName(patient)}</p>
              <p className="text-sm text-muted-foreground">{patient.patientCode} · {age} yrs · {patient.sex === 'female' ? 'Female' : 'Male'}</p>
              <Button variant="outline" size="sm" className="mt-3" onClick={() => setEditOpen(true)}>
                <Pencil className="h-3.5 w-3.5" /> Edit
              </Button>
            </div>

            <div className="mt-6 space-y-3 text-sm">
              <p className="flex items-center gap-2 text-muted-foreground"><Phone className="h-3.5 w-3.5" /> {patient.phone}</p>
              <p className="flex items-center gap-2 text-muted-foreground"><Mail className="h-3.5 w-3.5" /> {patient.email}</p>
              <p className="flex items-center gap-2 text-muted-foreground"><Calendar className="h-3.5 w-3.5" /> DOB {formatDate(patient.dob)}</p>
              <p className="flex items-center gap-2 text-muted-foreground"><Stethoscope className="h-3.5 w-3.5" /> {patient.primaryDoctor}</p>
            </div>

            {patient.notes && (
              <div className="mt-6 rounded-lg bg-muted p-3 text-sm text-muted-foreground">
                {patient.notes}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <div>
                <CardTitle>Cases</CardTitle>
                <CardDescription>{patientCases.length} case{patientCases.length !== 1 ? 's' : ''} on record</CardDescription>
              </div>
              <Button size="sm" variant="outline" onClick={() => navigate(`/cases?new=1&patientId=${patient.id}`)}>
                <Plus className="h-3.5 w-3.5" /> New Case
              </Button>
            </CardHeader>
            <CardContent className="space-y-2">
              {patientCases.length === 0 && <p className="text-sm text-muted-foreground">No cases yet for this patient.</p>}
              {patientCases.map((c) => (
                <Link
                  key={c.id}
                  to={`/cases/${c.id}`}
                  className="flex items-center justify-between rounded-lg border border-border p-3 text-sm hover:bg-surface-hover transition-colors"
                >
                  <div>
                    <p className="font-medium">{c.caseId}</p>
                    <p className="text-xs text-muted-foreground">{c.procedure} · {c.doctor}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground whitespace-nowrap">{formatDate(c.createdAt)}</span>
                    <StatusBadge status={c.status} />
                  </div>
                </Link>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Sales History</CardTitle>
              <CardDescription>Products permanently used or sold for this patient</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {patientSales.length === 0 && <p className="text-sm text-muted-foreground">No sales recorded for this patient.</p>}
              {patientSales.map((s) => (
                <div key={s.id} className="flex items-center justify-between rounded-lg border border-border p-3 text-sm">
                  <div>
                    <p className="font-medium">{s.saleNumber}</p>
                    <p className="text-xs text-muted-foreground">{s.lines.length} item(s) · {formatDate(s.createdAt)}</p>
                  </div>
                  <Badge variant="success">{formatCurrency(s.total)}</Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>

      <PatientFormDialog patient={patient} open={editOpen} onOpenChange={setEditOpen} />
    </div>
  )
}
