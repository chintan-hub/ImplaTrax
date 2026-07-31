import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'
import { DollarSign, AlertTriangle, HandCoins, ClipboardList, FolderKanban, TrendingUp } from 'lucide-react'
import { PageHeader } from '@/components/shared/PageHeader'
import { StatCard } from '@/components/shared/StatCard'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { useData } from '@/store/DataContext'
import { useChartColors } from '@/lib/chartColors'
import { formatCurrency, formatDate, initials } from '@/lib/utils'
import { openLoanValue } from '@/mocks/loans'
import { PAGE_INTROS } from '@/content/helpText'

export function DashboardPage() {
  const { products, movements, purchaseOrders, loans, cases, sales, labs, users } = useData()
  const colors = useChartColors()
  const navigate = useNavigate()

  const stats = useMemo(() => {
    const inventoryValue = products.reduce((sum, p) => sum + p.quantityOnHand * p.unitCost, 0)
    const lowStock = products.filter((p) => p.status === 'active' && p.quantityOnHand <= p.lowStockThreshold)
    const openLoans = loans.filter((l) => l.status !== 'closed')
    const pendingPOs = purchaseOrders.filter((po) => ['draft', 'submitted', 'confirmed', 'partially-received'].includes(po.status))
    const thisMonth = new Date()
    thisMonth.setDate(1)
    const casesThisMonth = cases.filter((c) => new Date(c.createdAt) >= thisMonth)
    const last30 = new Date()
    last30.setDate(last30.getDate() - 30)
    const revenue30d = sales.filter((s) => new Date(s.createdAt) >= last30).reduce((sum, s) => sum + s.total, 0)

    return { inventoryValue, lowStock, openLoans, pendingPOs, casesThisMonth, revenue30d }
  }, [products, loans, purchaseOrders, cases, sales])

  const movementChartData = useMemo(() => {
    const days = Array.from({ length: 14 }).map((_, i) => {
      const d = new Date()
      d.setDate(d.getDate() - (13 - i))
      d.setHours(0, 0, 0, 0)
      return d
    })
    return days.map((day) => {
      const next = new Date(day)
      next.setDate(next.getDate() + 1)
      const dayMovements = movements.filter((m) => {
        const t = new Date(m.createdAt).getTime()
        return t >= day.getTime() && t < next.getTime()
      })
      const inbound = dayMovements.filter((m) => m.quantity > 0).reduce((s, m) => s + m.quantity, 0)
      const outbound = dayMovements.filter((m) => m.quantity < 0).reduce((s, m) => s + Math.abs(m.quantity), 0)
      return { date: formatDate(day, { month: 'short', day: 'numeric', year: undefined }), inbound, outbound }
    })
  }, [movements])

  const valueByManufacturer = useMemo(() => {
    const map = new Map<string, number>()
    products.forEach((p) => {
      map.set(p.manufacturer, (map.get(p.manufacturer) ?? 0) + p.quantityOnHand * p.unitCost)
    })
    return Array.from(map.entries()).map(([manufacturer, value]) => ({ manufacturer, value: Math.round(value) }))
  }, [products])

  const recentMovements = movements.slice(0, 8)

  return (
    <div>
      <PageHeader title={PAGE_INTROS.dashboard.title} description={PAGE_INTROS.dashboard.description} />
      <p className="-mt-4 mb-6 text-xs font-medium uppercase tracking-wide text-primary-700 dark:text-primary-300">
        Every Component. Every Movement. Every Time.
      </p>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <StatCard label="Inventory Value" value={formatCurrency(stats.inventoryValue)} icon={DollarSign} tone="default" onClick={() => navigate('/products')} />
        <StatCard label="Low Stock Items" value={String(stats.lowStock.length)} icon={AlertTriangle} tone="warning" onClick={() => navigate('/inventory')} helpTerm="lowStock" />
        <StatCard label="Open Loans" value={String(stats.openLoans.length)} icon={HandCoins} tone="accent" onClick={() => navigate('/loans')} helpTerm="loan" />
        <StatCard label="Pending Purchase Orders" value={String(stats.pendingPOs.length)} icon={ClipboardList} tone="default" onClick={() => navigate('/purchase-orders')} helpTerm="purchaseOrder" />
        <StatCard label="Cases This Month" value={String(stats.casesThisMonth.length)} icon={FolderKanban} tone="success" onClick={() => navigate('/cases')} helpTerm="case" />
        <StatCard label="Revenue (30d)" value={formatCurrency(stats.revenue30d)} icon={TrendingUp} tone="success" onClick={() => navigate('/sales')} />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle>Stock Movements</CardTitle>
            <CardDescription>Inbound vs. outbound quantity over the last 14 days</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={movementChartData} margin={{ left: -20, right: 8 }}>
                <defs>
                  <linearGradient id="inboundFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={colors.categorical[0]} stopOpacity={0.25} />
                    <stop offset="100%" stopColor={colors.categorical[0]} stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="outboundFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={colors.categorical[1]} stopOpacity={0.25} />
                    <stop offset="100%" stopColor={colors.categorical[1]} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke={colors.chrome.grid} vertical={false} />
                <XAxis dataKey="date" stroke={colors.chrome.muted} fontSize={11} tickLine={false} axisLine={{ stroke: colors.chrome.axis }} />
                <YAxis stroke={colors.chrome.muted} fontSize={11} tickLine={false} axisLine={false} width={32} />
                <Tooltip
                  contentStyle={{ background: colors.chrome.surface, border: `1px solid ${colors.chrome.grid}`, borderRadius: 10, fontSize: 12 }}
                  labelStyle={{ color: colors.chrome.textPrimary }}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Area type="monotone" dataKey="inbound" name="Inbound" stroke={colors.categorical[0]} strokeWidth={2} fill="url(#inboundFill)" />
                <Area type="monotone" dataKey="outbound" name="Outbound" stroke={colors.categorical[1]} strokeWidth={2} fill="url(#outboundFill)" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Inventory Value by Manufacturer</CardTitle>
            <CardDescription>Current stock valuation at cost</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={valueByManufacturer} layout="vertical" margin={{ left: 8, right: 16 }}>
                <CartesianGrid stroke={colors.chrome.grid} horizontal={false} />
                <XAxis type="number" stroke={colors.chrome.muted} fontSize={11} tickLine={false} axisLine={false} hide />
                <YAxis
                  type="category"
                  dataKey="manufacturer"
                  stroke={colors.chrome.muted}
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  width={100}
                />
                <Tooltip
                  formatter={(v: number) => formatCurrency(v)}
                  contentStyle={{ background: colors.chrome.surface, border: `1px solid ${colors.chrome.grid}`, borderRadius: 10, fontSize: 12 }}
                />
                <Bar dataKey="value" radius={[0, 4, 4, 0]} fill={colors.categorical[0]} barSize={16} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
            <CardDescription>Latest stock movements</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {recentMovements.map((m) => {
              const product = products.find((p) => p.id === m.productId)
              const user = users.find((u) => u.id === m.performedBy)
              return (
                <div key={m.id} className="flex items-start gap-3 text-sm">
                  <Avatar className="h-7 w-7 mt-0.5">
                    <AvatarFallback style={{ backgroundColor: user?.avatarColor, color: 'white' }} className="text-[10px]">
                      {user ? initials(user.name) : '—'}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="truncate">
                      <span className="font-medium">{product?.name ?? 'Unknown product'}</span>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {m.reason} · {formatDate(m.createdAt)}
                    </p>
                  </div>
                  <span className={m.quantity >= 0 ? 'text-success-600 text-sm font-medium' : 'text-danger-600 text-sm font-medium'}>
                    {m.quantity >= 0 ? '+' : ''}
                    {m.quantity}
                  </span>
                </div>
              )
            })}
            {recentMovements.length === 0 && <p className="text-sm text-muted-foreground">No recent activity yet.</p>}
          </CardContent>
        </Card>

        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Low Stock</CardTitle>
            <CardDescription>Products at or below reorder threshold</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {stats.lowStock.slice(0, 8).map((p) => (
              <div key={p.id} className="flex items-center justify-between text-sm">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{p.name}</p>
                  <p className="text-xs text-muted-foreground">{p.sku}</p>
                </div>
                <Badge variant={p.quantityOnHand === 0 ? 'danger' : 'warning'} className="ml-2 shrink-0">
                  {p.quantityOnHand} / {p.lowStockThreshold}
                </Badge>
              </div>
            ))}
            {stats.lowStock.length === 0 && <p className="text-sm text-muted-foreground">All products are well stocked.</p>}
          </CardContent>
        </Card>

        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Outstanding Loans</CardTitle>
            <CardDescription>Open items currently with labs</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {stats.openLoans.slice(0, 8).map((loan) => {
              const lab = labs.find((l) => l.id === loan.labId)
              return (
                <div key={loan.id} className="flex items-center justify-between text-sm">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{lab?.name}</p>
                    <p className="text-xs text-muted-foreground">{loan.loanNumber} · {openLoanValue(loan)} items out</p>
                  </div>
                  <StatusBadge status={loan.status} />
                </div>
              )
            })}
            {stats.openLoans.length === 0 && <p className="text-sm text-muted-foreground">No open loans.</p>}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
