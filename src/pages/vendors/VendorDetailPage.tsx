import { useMemo } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { ArrowLeft, Star, Mail, Phone, MapPin, Building2 } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { StatCard } from '@/components/shared/StatCard'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { EmptyState } from '@/components/shared/EmptyState'
import { useData } from '@/store/DataContext'
import { formatCurrency, formatDate } from '@/lib/utils'
import { ClipboardList, TrendingUp } from 'lucide-react'

export function VendorDetailPage() {
  const { vendorId } = useParams()
  const navigate = useNavigate()
  const { vendors, purchaseOrders } = useData()

  const vendor = vendors.find((v) => v.id === vendorId)
  const vendorPOs = useMemo(
    () => purchaseOrders.filter((po) => po.vendorId === vendorId).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [purchaseOrders, vendorId],
  )

  if (!vendor) {
    return <EmptyState icon={Building2} title="Vendor not found" action={<Button onClick={() => navigate('/vendors')}>Back to Vendors</Button>} />
  }

  const pendingPOs = vendorPOs.filter((po) => ['draft', 'submitted', 'confirmed', 'partially-received'].includes(po.status))
  const totalSpend = vendorPOs.reduce((sum, po) => sum + po.lines.reduce((s, l) => s + l.unitCost * l.quantityOrdered, 0), 0)

  return (
    <div>
      <button onClick={() => navigate('/vendors')} className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-3.5 w-3.5" /> Back to Vendors
      </button>

      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{vendor.name}</h1>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {vendor.manufacturers.map((m) => <Badge key={m} variant="outline">{m}</Badge>)}
          </div>
        </div>
        <span className="flex items-center gap-1 text-lg font-semibold">
          <Star className="h-4 w-4 fill-warning-500 text-warning-500" /> {Math.round(vendor.onTimeRate * 100)}% on-time
        </span>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 mb-6">
        <StatCard label="Total Purchase Orders" value={String(vendorPOs.length)} icon={ClipboardList} />
        <StatCard label="Pending Orders" value={String(pendingPOs.length)} icon={ClipboardList} tone="warning" />
        <StatCard label="Total Spend" value={formatCurrency(totalSpend)} icon={TrendingUp} tone="success" />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-1 h-fit">
          <CardHeader>
            <CardTitle>Contact</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p className="font-medium">{vendor.contactName}</p>
            <p className="flex items-center gap-2 text-muted-foreground"><Mail className="h-3.5 w-3.5" /> {vendor.email}</p>
            <p className="flex items-center gap-2 text-muted-foreground"><Phone className="h-3.5 w-3.5" /> {vendor.phone}</p>
            <p className="flex items-center gap-2 text-muted-foreground"><MapPin className="h-3.5 w-3.5" /> {vendor.address}, {vendor.country}</p>
            <p className="text-xs text-muted-foreground pt-2 border-t border-border">Vendor since {formatDate(vendor.createdAt)}</p>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Purchase Order History</CardTitle>
            <CardDescription>All purchase orders placed with this vendor</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {vendorPOs.length === 0 && <p className="text-sm text-muted-foreground">No purchase orders placed with this vendor yet.</p>}
            {vendorPOs.map((po) => (
              <Link
                key={po.id}
                to={`/purchase-orders/${po.id}`}
                className="flex items-center justify-between rounded-lg border border-border p-3 text-sm hover:bg-surface-hover transition-colors"
              >
                <div>
                  <p className="font-medium">{po.poNumber}</p>
                  <p className="text-xs text-muted-foreground">{po.lines.length} line item(s) · Created {formatDate(po.createdAt)}</p>
                </div>
                <StatusBadge status={po.status} />
              </Link>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
