import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Search, Mail, Phone, MapPin, Star, Download } from 'lucide-react'
import { StickyActionHeader } from '@/components/shared/StickyActionHeader'
import { EmptyState } from '@/components/shared/EmptyState'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { VendorFormDialog } from '@/components/vendors/VendorFormDialog'
import { useData } from '@/store/DataContext'
import { exportToCsv } from '@/lib/documents/csv'
import { PAGE_INTROS, EMPTY_STATES } from '@/content/helpText'

export function VendorsPage() {
  const navigate = useNavigate()
  const { vendors, purchaseOrders } = useData()
  const [search, setSearch] = useState('')
  const [formOpen, setFormOpen] = useState(false)

  const poCountByVendor = useMemo(() => {
    const map = new Map<string, number>()
    purchaseOrders.forEach((po) => map.set(po.vendorId, (map.get(po.vendorId) ?? 0) + 1))
    return map
  }, [purchaseOrders])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return vendors.filter((v) => !q || v.name.toLowerCase().includes(q) || v.contactName.toLowerCase().includes(q))
  }, [vendors, search])

  const handleExportCsv = () => {
    const rows = filtered.map((v) => ({
      Vendor: v.name,
      Contact: v.contactName,
      Email: v.email,
      Phone: v.phone,
      Country: v.country,
      Manufacturers: v.manufacturers.join('; '),
      'On-Time Rate': `${Math.round(v.onTimeRate * 100)}%`,
      'Purchase Orders': poCountByVendor.get(v.id) ?? 0,
      'Lifetime Purchase Orders': v.totalOrders,
    }))
    exportToCsv(rows, `vendors-${new Date().toISOString().slice(0, 10)}.csv`)
  }

  return (
    <div>
      <StickyActionHeader
        title={PAGE_INTROS.vendors.title}
        description={`${PAGE_INTROS.vendors.description} ${vendors.length} vendors in your directory.`}
        helpTerm="vendor"
        actions={
          <>
            <Button variant="outline" onClick={handleExportCsv} disabled={filtered.length === 0}>
              <Download className="h-4 w-4" /> Export CSV
            </Button>
            <Button onClick={() => setFormOpen(true)}>
              <Plus className="h-4 w-4" /> Add Vendor
            </Button>
          </>
        }
        toolbar={
          <div className="relative max-w-sm flex-1">
            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Search vendors..." className="pl-8" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
        }
      />

      {filtered.length === 0 ? (
        <EmptyState
          icon={Search}
          title={EMPTY_STATES.vendors.title}
          description={EMPTY_STATES.vendors.description}
          action={
            <Button size="sm" onClick={() => setFormOpen(true)}>
              <Plus className="h-4 w-4" /> {EMPTY_STATES.vendors.actionLabel}
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((v) => (
            <Card key={v.id} onClick={() => navigate(`/vendors/${v.id}`)} className="cursor-pointer transition-all hover:shadow-elevated hover:-translate-y-0.5">
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <p className="font-semibold leading-snug">{v.name}</p>
                  <Badge variant="secondary" className="gap-1 shrink-0">
                    <Star className="h-3 w-3 fill-warning-500 text-warning-500" />
                    {Math.round(v.onTimeRate * 100)}% on-time
                  </Badge>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{v.contactName}</p>

                <div className="mt-4 space-y-1.5 text-sm text-muted-foreground">
                  <p className="flex items-center gap-2"><Mail className="h-3.5 w-3.5" /> {v.email}</p>
                  <p className="flex items-center gap-2"><Phone className="h-3.5 w-3.5" /> {v.phone}</p>
                  <p className="flex items-center gap-2"><MapPin className="h-3.5 w-3.5" /> {v.country}</p>
                </div>

                <div className="mt-4 flex flex-wrap gap-1.5">
                  {v.manufacturers.map((m) => <Badge key={m} variant="outline">{m}</Badge>)}
                </div>

                <div className="mt-4 flex items-center justify-between border-t border-border pt-3 text-sm">
                  <span className="text-muted-foreground">{poCountByVendor.get(v.id) ?? 0} purchase orders</span>
                  <span className="text-muted-foreground">{v.totalOrders} lifetime purchase orders</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <VendorFormDialog open={formOpen} onOpenChange={setFormOpen} />
    </div>
  )
}
