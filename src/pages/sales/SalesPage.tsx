import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Plus, Search, Receipt } from 'lucide-react'
import { PageHeader } from '@/components/shared/PageHeader'
import { StickyToolbar } from '@/components/shared/StickyToolbar'
import { EmptyState } from '@/components/shared/EmptyState'
import { StatCard } from '@/components/shared/StatCard'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { SaleFormDialog } from '@/components/sales/SaleFormDialog'
import { useData } from '@/store/DataContext'
import { patientFullName } from '@/mocks/patients'
import { formatCurrency, formatDate } from '@/lib/utils'
import { PAGE_INTROS, EMPTY_STATES } from '@/content/helpText'
import { DollarSign, TrendingUp, Package } from 'lucide-react'

export function SalesPage() {
  const { sales, patients, cases, products } = useData()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const [search, setSearch] = useState('')
  const [formOpen, setFormOpen] = useState(false)

  useEffect(() => {
    if (params.get('new') === '1') {
      setFormOpen(true)
      params.delete('new')
      setParams(params, { replace: true })
    }
  }, [params, setParams])

  const patientById = useMemo(() => new Map(patients.map((p) => [p.id, p])), [patients])
  const caseById = useMemo(() => new Map(cases.map((c) => [c.id, c])), [cases])
  const productById = useMemo(() => new Map(products.map((p) => [p.id, p])), [products])

  const stats = useMemo(() => {
    const totalRevenue = sales.reduce((s, sale) => s + sale.total, 0)
    const totalUnits = sales.reduce((s, sale) => s + sale.lines.reduce((a, l) => a + l.quantity, 0), 0)
    const avgSale = sales.length ? totalRevenue / sales.length : 0
    return { totalRevenue, totalUnits, avgSale }
  }, [sales])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return sales.filter((s) => {
      if (!q) return true
      const patient = s.patientId ? patientById.get(s.patientId) : undefined
      const caseRecord = s.caseId ? caseById.get(s.caseId) : undefined
      return (
        s.saleNumber.toLowerCase().includes(q) ||
        (patient && patientFullName(patient).toLowerCase().includes(q)) ||
        (caseRecord && caseRecord.caseId.toLowerCase().includes(q))
      )
    })
  }, [sales, search, patientById, caseById])

  return (
    <div>
      <PageHeader
        title={PAGE_INTROS.sales.title}
        description={PAGE_INTROS.sales.description}
        actions={
          <Button onClick={() => setFormOpen(true)}>
            <Plus className="h-4 w-4" /> Record Sale
          </Button>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 mb-6">
        <StatCard label="Total Revenue" value={formatCurrency(stats.totalRevenue)} icon={DollarSign} tone="success" />
        <StatCard label="Units Sold" value={String(stats.totalUnits)} icon={Package} />
        <StatCard label="Average Sale" value={formatCurrency(Math.round(stats.avgSale))} icon={TrendingUp} tone="accent" />
      </div>

      <StickyToolbar>
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search sale #, patient, case ID..." className="pl-8" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      </StickyToolbar>

      {filtered.length === 0 ? (
        <EmptyState
          icon={Receipt}
          title={EMPTY_STATES.sales.title}
          description={EMPTY_STATES.sales.description}
          action={
            <Button size="sm" onClick={() => setFormOpen(true)}>
              <Plus className="h-4 w-4" /> {EMPTY_STATES.sales.actionLabel}
            </Button>
          }
        />
      ) : (
        <div className="rounded-xl border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Sale #</TableHead>
                <TableHead>Patient</TableHead>
                <TableHead>Case</TableHead>
                <TableHead>Items</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead>Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((s) => {
                const patient = s.patientId ? patientById.get(s.patientId) : undefined
                const caseRecord = s.caseId ? caseById.get(s.caseId) : undefined
                return (
                  <TableRow key={s.id} className="cursor-pointer" onClick={() => navigate(`/sales/${s.id}`)}>
                    <TableCell className="font-medium">{s.saleNumber}</TableCell>
                    <TableCell>{patient ? patientFullName(patient) : <span className="text-muted-foreground">Direct sale</span>}</TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">{caseRecord?.caseId ?? '—'}</TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-0.5">
                        {s.lines.slice(0, 2).map((l, i) => (
                          <span key={i} className="text-xs text-muted-foreground">{l.quantity}× {productById.get(l.productId)?.name}</span>
                        ))}
                        {s.lines.length > 2 && <Badge variant="secondary" className="w-fit">+{s.lines.length - 2} more</Badge>}
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-medium tabular-nums">{formatCurrency(s.total)}</TableCell>
                    <TableCell className="text-muted-foreground whitespace-nowrap">{formatDate(s.createdAt)}</TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <SaleFormDialog open={formOpen} onOpenChange={setFormOpen} />
    </div>
  )
}
