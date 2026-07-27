import { useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Plus, Search } from 'lucide-react'
import { PageHeader } from '@/components/shared/PageHeader'
import { StickyToolbar } from '@/components/shared/StickyToolbar'
import { EmptyState } from '@/components/shared/EmptyState'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { CaseFormDialog } from '@/components/cases/CaseFormDialog'
import { TermHint } from '@/components/ui/help-tooltip'
import { useData } from '@/store/DataContext'
import { patientFullName } from '@/mocks/patients'
import { formatDate } from '@/lib/utils'
import { DOCTORS } from '@/mocks/names'
import { PAGE_INTROS, EMPTY_STATES } from '@/content/helpText'
import type { CaseStatus } from '@/types'

const STATUSES: CaseStatus[] = ['planning', 'surgery-scheduled', 'in-progress', 'restoration', 'completed', 'cancelled']

export function CasesPage() {
  const { cases, patients, labs } = useData()
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('all')
  const [doctor, setDoctor] = useState('all')
  const [labFilter, setLabFilter] = useState('all')
  const [formOpen, setFormOpen] = useState(params.get('new') === '1')

  const patientById = useMemo(() => new Map(patients.map((p) => [p.id, p])), [patients])
  const labById = useMemo(() => new Map(labs.map((l) => [l.id, l])), [labs])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return cases.filter((c) => {
      const patient = patientById.get(c.patientId)
      if (status !== 'all' && c.status !== status) return false
      if (doctor !== 'all' && c.doctor !== doctor) return false
      if (labFilter !== 'all' && c.labId !== labFilter) return false
      if (q && !(c.caseId.toLowerCase().includes(q) || (patient && patientFullName(patient).toLowerCase().includes(q)))) return false
      return true
    })
  }, [cases, search, status, doctor, labFilter, patientById])

  return (
    <div>
      <PageHeader
        title={PAGE_INTROS.cases.title}
        helpTerm="case"
        description={`${PAGE_INTROS.cases.description} ${cases.length} cases tracked.`}
        actions={
          <Button onClick={() => setFormOpen(true)}>
            <Plus className="h-4 w-4" /> New Case
          </Button>
        }
      />

      <StickyToolbar className="sm:flex-wrap">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search Case ID or patient..." className="pl-8" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-full sm:w-48"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={doctor} onValueChange={setDoctor}>
          <SelectTrigger className="w-full sm:w-52"><SelectValue placeholder="Doctor" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All doctors</SelectItem>
            {DOCTORS.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={labFilter} onValueChange={setLabFilter}>
          <SelectTrigger className="w-full sm:w-52"><SelectValue placeholder="Lab" /></SelectTrigger>
          <SelectContent className="max-h-72">
            <SelectItem value="all">All labs</SelectItem>
            {labs.map((l) => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </StickyToolbar>

      {filtered.length === 0 ? (
        <EmptyState
          icon={Search}
          title={EMPTY_STATES.cases.title}
          description={EMPTY_STATES.cases.description}
          action={
            <Button size="sm" onClick={() => setFormOpen(true)}>
              <Plus className="h-4 w-4" /> {EMPTY_STATES.cases.actionLabel}
            </Button>
          }
        />
      ) : (
        <div className="rounded-xl border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>
                  <span className="inline-flex items-center gap-1">
                    Case ID <TermHint term="caseId" iconOnly />
                  </span>
                </TableHead>
                <TableHead>Patient</TableHead>
                <TableHead>Procedure</TableHead>
                <TableHead>Doctor</TableHead>
                <TableHead>Lab</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((c) => {
                const patient = patientById.get(c.patientId)
                const lab = c.labId ? labById.get(c.labId) : undefined
                return (
                  <TableRow key={c.id} className="cursor-pointer" onClick={() => navigate(`/cases/${c.id}`)}>
                    <TableCell className="font-medium font-mono text-xs">{c.caseId}</TableCell>
                    <TableCell>{patient ? patientFullName(patient) : '—'}</TableCell>
                    <TableCell className="max-w-[200px] truncate">{c.procedure}</TableCell>
                    <TableCell className="text-muted-foreground">{c.doctor}</TableCell>
                    <TableCell className="text-muted-foreground">{lab?.name ?? '—'}</TableCell>
                    <TableCell><StatusBadge status={c.status} /></TableCell>
                    <TableCell className="text-muted-foreground whitespace-nowrap">{formatDate(c.createdAt)}</TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <CaseFormDialog open={formOpen} onOpenChange={setFormOpen} />
    </div>
  )
}
