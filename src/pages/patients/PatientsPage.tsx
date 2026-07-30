import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Plus, Search, Download } from 'lucide-react'
import { PageHeader } from '@/components/shared/PageHeader'
import { StickyToolbar } from '@/components/shared/StickyToolbar'
import { EmptyState } from '@/components/shared/EmptyState'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { PatientFormDialog } from '@/components/patients/PatientFormDialog'
import { useData } from '@/store/DataContext'
import { patientFullName } from '@/mocks/patients'
import { formatDate, initials } from '@/lib/utils'
import { exportToCsv } from '@/lib/documents/csv'
import { PAGE_INTROS, EMPTY_STATES } from '@/content/helpText'

export function PatientsPage() {
  const { patients, cases } = useData()
  const [params, setParams] = useSearchParams()
  const [search, setSearch] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    if (params.get('new') === '1') {
      setFormOpen(true)
      params.delete('new')
      setParams(params, { replace: true })
    }
  }, [params, setParams])

  const caseCountByPatient = useMemo(() => {
    const map = new Map<string, number>()
    cases.forEach((c) => map.set(c.patientId, (map.get(c.patientId) ?? 0) + 1))
    return map
  }, [cases])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return patients.filter((p) => !q || patientFullName(p).toLowerCase().includes(q) || p.patientCode.toLowerCase().includes(q) || p.primaryDoctor.toLowerCase().includes(q))
  }, [patients, search])

  const handleExportCsv = () => {
    const rows = filtered.map((p) => ({
      Patient: patientFullName(p),
      Code: p.patientCode,
      Sex: p.sex === 'female' ? 'Female' : 'Male',
      'Primary Doctor': p.primaryDoctor,
      Cases: caseCountByPatient.get(p.id) ?? 0,
      Phone: p.phone,
      Email: p.email,
      DOB: formatDate(p.dob),
      Added: formatDate(p.createdAt),
    }))
    exportToCsv(rows, `patients-${new Date().toISOString().slice(0, 10)}.csv`)
  }

  return (
    <div>
      <PageHeader
        title={PAGE_INTROS.patients.title}
        helpTerm="patient"
        description={`${PAGE_INTROS.patients.description} ${patients.length} patients on record.`}
        actions={
          <>
            <Button variant="outline" onClick={handleExportCsv} disabled={filtered.length === 0}>
              <Download className="h-4 w-4" /> Export CSV
            </Button>
            <Button onClick={() => setFormOpen(true)}>
              <Plus className="h-4 w-4" /> Add Patient
            </Button>
          </>
        }
      />

      <StickyToolbar>
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search patients, code, doctor..." className="pl-8" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      </StickyToolbar>

      {filtered.length === 0 ? (
        <EmptyState
          icon={Search}
          title={EMPTY_STATES.patients.title}
          description={EMPTY_STATES.patients.description}
          action={
            <Button size="sm" onClick={() => setFormOpen(true)}>
              <Plus className="h-4 w-4" /> {EMPTY_STATES.patients.actionLabel}
            </Button>
          }
        />
      ) : (
        <div className="rounded-xl border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Patient</TableHead>
                <TableHead>Code</TableHead>
                <TableHead>Primary Doctor</TableHead>
                <TableHead>Cases</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Added</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((p) => (
                <TableRow key={p.id} className="cursor-pointer" onClick={() => navigate(`/patients/${p.id}`)}>
                  <TableCell>
                    <div className="flex items-center gap-2.5">
                      <Avatar className="h-8 w-8">
                        <AvatarFallback className="text-xs">{initials(patientFullName(p))}</AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium">{patientFullName(p)}</p>
                        <p className="text-xs text-muted-foreground">{p.sex === 'female' ? 'Female' : 'Male'}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{p.patientCode}</TableCell>
                  <TableCell>{p.primaryDoctor}</TableCell>
                  <TableCell><Badge variant="secondary">{caseCountByPatient.get(p.id) ?? 0}</Badge></TableCell>
                  <TableCell className="text-muted-foreground">{p.phone}</TableCell>
                  <TableCell className="text-muted-foreground whitespace-nowrap">{formatDate(p.createdAt)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <PatientFormDialog open={formOpen} onOpenChange={setFormOpen} />
    </div>
  )
}
