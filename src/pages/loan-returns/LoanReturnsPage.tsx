import { useMemo, useState } from 'react'
import { Search, Undo2 } from 'lucide-react'
import { PageHeader } from '@/components/shared/PageHeader'
import { StickyToolbar } from '@/components/shared/StickyToolbar'
import { EmptyState } from '@/components/shared/EmptyState'
import { StatCard } from '@/components/shared/StatCard'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { TermHint } from '@/components/ui/help-tooltip'
import { useData } from '@/store/DataContext'
import { formatDateTime } from '@/lib/utils'
import { PAGE_INTROS, EMPTY_STATES } from '@/content/helpText'
import { PackageCheck, AlertTriangle } from 'lucide-react'

export function LoanReturnsPage() {
  const { movements, products, loans, labs } = useData()
  const [search, setSearch] = useState('')
  const [labFilter, setLabFilter] = useState('all')

  const productById = useMemo(() => new Map(products.map((p) => [p.id, p])), [products])
  const loanByNumber = useMemo(() => new Map(loans.map((l) => [l.loanNumber, l])), [loans])
  const labById = useMemo(() => new Map(labs.map((l) => [l.id, l])), [labs])

  const returnEvents = useMemo(
    () => movements.filter((m) => m.type === 'loan-return' || m.type === 'lost').sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [movements],
  )

  const stats = useMemo(() => {
    const returned = returnEvents.filter((m) => m.type === 'loan-return').reduce((s, m) => s + m.quantity, 0)
    const lost = returnEvents.filter((m) => m.type === 'lost').reduce((s, m) => s + Math.abs(m.quantity), 0)
    return { returned, lost, events: returnEvents.length }
  }, [returnEvents])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return returnEvents.filter((m) => {
      const loan = m.reference ? loanByNumber.get(m.reference) : undefined
      const lab = loan ? labById.get(loan.labId) : undefined
      if (labFilter !== 'all' && lab?.id !== labFilter) return false
      if (q) {
        const product = productById.get(m.productId)
        const hay = `${product?.name ?? ''} ${m.reference ?? ''} ${lab?.name ?? ''}`.toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })
  }, [returnEvents, search, labFilter, loanByNumber, labById, productById])

  return (
    <div>
      <PageHeader title={PAGE_INTROS.loanReturns.title} description={PAGE_INTROS.loanReturns.description} helpTerm="loanReturn" />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 mb-6">
        <StatCard label="Total Return Events" value={String(stats.events)} icon={Undo2} helpTerm="loanReturn" />
        <StatCard label="Units Returned" value={String(stats.returned)} icon={PackageCheck} tone="success" />
        <StatCard label="Units Lost" value={String(stats.lost)} icon={AlertTriangle} tone="danger" />
      </div>

      <StickyToolbar>
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search product, loan #, lab..." className="pl-8" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select value={labFilter} onValueChange={setLabFilter}>
          <SelectTrigger className="w-full sm:w-52"><SelectValue placeholder="Lab" /></SelectTrigger>
          <SelectContent className="max-h-72">
            <SelectItem value="all">All labs</SelectItem>
            {labs.map((l) => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </StickyToolbar>

      {filtered.length === 0 ? (
        <EmptyState icon={Search} title={EMPTY_STATES.loanReturns.title} description={EMPTY_STATES.loanReturns.description} />
      ) : (
        <div className="rounded-xl border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead>
                  <span className="inline-flex items-center gap-1">
                    Loan <TermHint term="loan" iconOnly />
                  </span>
                </TableHead>
                <TableHead>Lab</TableHead>
                <TableHead>Outcome</TableHead>
                <TableHead className="text-right">Quantity</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead>Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((m) => {
                const product = productById.get(m.productId)
                const loan = m.reference ? loanByNumber.get(m.reference) : undefined
                const lab = loan ? labById.get(loan.labId) : undefined
                return (
                  <TableRow key={m.id}>
                    <TableCell>
                      <p className="font-medium">{product?.name}</p>
                      <p className="text-xs text-muted-foreground">{product?.sku}</p>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{m.reference}</TableCell>
                    <TableCell className="text-muted-foreground">{lab?.name ?? '—'}</TableCell>
                    <TableCell>
                      <Badge variant={m.type === 'loan-return' ? 'success' : 'danger'}>{m.type === 'loan-return' ? 'Returned' : 'Lost'}</Badge>
                    </TableCell>
                    <TableCell className="text-right tabular-nums font-medium">{Math.abs(m.quantity)}</TableCell>
                    <TableCell className="max-w-[240px] truncate text-muted-foreground">{m.reason}</TableCell>
                    <TableCell className="text-muted-foreground whitespace-nowrap">{formatDateTime(m.createdAt)}</TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
