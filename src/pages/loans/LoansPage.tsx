import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Plus, Search, HandCoins, Undo2 } from 'lucide-react'
import { PageHeader } from '@/components/shared/PageHeader'
import { StickyToolbar } from '@/components/shared/StickyToolbar'
import { EmptyState } from '@/components/shared/EmptyState'
import { StatCard } from '@/components/shared/StatCard'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { LoanFormDialog } from '@/components/loans/LoanFormDialog'
import { LoanStatusActions } from '@/components/loans/LoanStatusActions'
import { TermHint } from '@/components/ui/help-tooltip'
import { useData } from '@/store/DataContext'
import { formatDate } from '@/lib/utils'
import { openLoanValue } from '@/mocks/loans'
import { PAGE_INTROS, EMPTY_STATES } from '@/content/helpText'
import type { LoanStatus } from '@/types'
import { AlertTriangle } from 'lucide-react'

const STATUSES: LoanStatus[] = ['open', 'partially-returned', 'closed']

export function LoansPage() {
  const { loans, labs } = useData()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('all')
  const [labFilter, setLabFilter] = useState('all')
  const [formOpen, setFormOpen] = useState(false)

  useEffect(() => {
    if (params.get('new') === '1') {
      setFormOpen(true)
      params.delete('new')
      setParams(params, { replace: true })
    }
  }, [params, setParams])

  const labById = useMemo(() => new Map(labs.map((l) => [l.id, l])), [labs])

  const stats = useMemo(() => {
    const open = loans.filter((l) => l.status !== 'closed')
    const outstandingItems = open.reduce((sum, l) => sum + openLoanValue(l), 0)
    const lostItems = loans.reduce((sum, l) => sum + l.lines.reduce((a, line) => a + line.quantityLost, 0), 0)
    return { openCount: open.length, outstandingItems, lostItems }
  }, [loans])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return loans
      .filter((l) => {
        if (status !== 'all' && l.status !== status) return false
        if (labFilter !== 'all' && l.labId !== labFilter) return false
        if (q) {
          const lab = labById.get(l.labId)
          if (!(l.loanNumber.toLowerCase().includes(q) || lab?.name.toLowerCase().includes(q))) return false
        }
        return true
      })
      .sort((a, b) => new Date(b.issuedAt).getTime() - new Date(a.issuedAt).getTime())
  }, [loans, search, status, labFilter, labById])

  return (
    <div>
      <PageHeader
        title={PAGE_INTROS.loans.title}
        helpTerm="loan"
        description="Loans are issued only to labs and may remain open for months with partial returns."
        actions={
          <Button onClick={() => setFormOpen(true)}>
            <Plus className="h-4 w-4" /> Issue Loan
          </Button>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 mb-6">
        <StatCard label="Open Loans" value={String(stats.openCount)} icon={HandCoins} tone="warning" helpTerm="loan" />
        <StatCard label="Outstanding Items" value={String(stats.outstandingItems)} icon={Undo2} tone="accent" />
        <StatCard label="Lost Products (all time)" value={String(stats.lostItems)} icon={AlertTriangle} tone="danger" />
      </div>

      <StickyToolbar>
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search loan # or lab..." className="pl-8" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-full sm:w-44"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
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
          title={EMPTY_STATES.loans.title}
          description={EMPTY_STATES.loans.description}
          action={
            <Button size="sm" onClick={() => setFormOpen(true)}>
              <Plus className="h-4 w-4" /> {EMPTY_STATES.loans.actionLabel}
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
                    Loan # <TermHint term="loan" iconOnly />
                  </span>
                </TableHead>
                <TableHead>Lab</TableHead>
                <TableHead>Items</TableHead>
                <TableHead className="text-right">Outstanding</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Issued</TableHead>
                <TableHead>Due</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((loan) => {
                const lab = labById.get(loan.labId)
                const outstanding = openLoanValue(loan)
                return (
                  <TableRow key={loan.id} className="cursor-pointer" onClick={() => navigate(`/loans/${loan.id}`)}>
                    <TableCell className="font-medium">{loan.loanNumber}</TableCell>
                    <TableCell>{lab?.name}</TableCell>
                    <TableCell className="text-muted-foreground">{loan.lines.length} product(s)</TableCell>
                    <TableCell className="text-right font-medium tabular-nums">{outstanding}</TableCell>
                    <TableCell><StatusBadge status={loan.status} /></TableCell>
                    <TableCell className="text-muted-foreground whitespace-nowrap">{formatDate(loan.issuedAt)}</TableCell>
                    <TableCell className="text-muted-foreground whitespace-nowrap">{loan.dueDate ? formatDate(loan.dueDate) : '—'}</TableCell>
                    <TableCell className="text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                      <LoanStatusActions loan={loan} size="sm" />
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <LoanFormDialog open={formOpen} onOpenChange={setFormOpen} />
    </div>
  )
}
