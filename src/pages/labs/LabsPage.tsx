import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Search, Star, Clock } from 'lucide-react'
import { PageHeader } from '@/components/shared/PageHeader'
import { StickyToolbar } from '@/components/shared/StickyToolbar'
import { EmptyState } from '@/components/shared/EmptyState'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { LabFormDialog } from '@/components/labs/LabFormDialog'
import { useData } from '@/store/DataContext'
import { openLoanValue } from '@/mocks/loans'
import { PAGE_INTROS, EMPTY_STATES } from '@/content/helpText'

export function LabsPage() {
  const { labs, loans } = useData()
  const [search, setSearch] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const navigate = useNavigate()

  const outstandingByLab = useMemo(() => {
    const map = new Map<string, number>()
    loans.filter((l) => l.status !== 'closed').forEach((l) => map.set(l.labId, (map.get(l.labId) ?? 0) + openLoanValue(l)))
    return map
  }, [loans])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return labs.filter((l) => !q || l.name.toLowerCase().includes(q))
  }, [labs, search])

  return (
    <div>
      <PageHeader
        title={PAGE_INTROS.labs.title}
        helpTerm="lab"
        description={`${PAGE_INTROS.labs.description} ${labs.length} partner labs.`}
        actions={
          <Button onClick={() => setFormOpen(true)}>
            <Plus className="h-4 w-4" /> Add Lab
          </Button>
        }
      />

      <StickyToolbar>
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search labs..." className="pl-8" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      </StickyToolbar>

      {filtered.length === 0 ? (
        <EmptyState
          icon={Search}
          title={EMPTY_STATES.labs.title}
          description={EMPTY_STATES.labs.description}
          action={
            <Button size="sm" onClick={() => setFormOpen(true)}>
              <Plus className="h-4 w-4" /> {EMPTY_STATES.labs.actionLabel}
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((lab) => {
            const outstanding = outstandingByLab.get(lab.id) ?? 0
            return (
              <Card key={lab.id} className="cursor-pointer transition-all hover:shadow-elevated hover:-translate-y-0.5" onClick={() => navigate(`/labs/${lab.id}`)}>
                <CardContent className="p-5">
                  <div className="flex items-start justify-between">
                    <p className="font-semibold leading-snug">{lab.name}</p>
                    <span className="flex items-center gap-1 text-sm font-medium shrink-0">
                      <Star className="h-3.5 w-3.5 fill-warning-500 text-warning-500" /> {lab.rating.toFixed(1)}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">{lab.contactName}</p>

                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {lab.specialties.map((s) => <Badge key={s} variant="outline">{s}</Badge>)}
                  </div>

                  <div className="mt-4 flex items-center justify-between border-t border-border pt-3 text-sm">
                    <span className="flex items-center gap-1.5 text-muted-foreground">
                      <Clock className="h-3.5 w-3.5" /> {lab.turnaroundDays}d turnaround
                    </span>
                    {outstanding > 0 ? (
                      <Badge variant="warning">{outstanding} items on loan</Badge>
                    ) : (
                      <Badge variant="secondary">No open loans</Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      <LabFormDialog open={formOpen} onOpenChange={setFormOpen} />
    </div>
  )
}
