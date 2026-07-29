import { useMemo } from 'react'
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import { PageHeader } from '@/components/shared/PageHeader'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { StatCard } from '@/components/shared/StatCard'
import { useData } from '@/store/DataContext'
import { useChartColors } from '@/lib/chartColors'
import { formatCurrency } from '@/lib/utils'
import { exportToCsv } from '@/lib/documents/csv'
import { PAGE_INTROS } from '@/content/helpText'
import { DollarSign, TrendingUp, HandCoins, ClipboardList, Package, AlertTriangle, Download } from 'lucide-react'

function ExportCsvButton({ rows, filename }: { rows: Record<string, string | number>[]; filename: string }) {
  return (
    <Button variant="outline" size="sm" onClick={() => exportToCsv(rows, filename)} disabled={rows.length === 0}>
      <Download className="h-3.5 w-3.5" /> Export CSV
    </Button>
  )
}

export function ReportsPage() {
  const { products, sales, loans, purchaseOrders, movements, vendors } = useData()
  const colors = useChartColors()

  const inventoryByCategory = useMemo(() => {
    const map = new Map<string, number>()
    products.forEach((p) => map.set(p.category, (map.get(p.category) ?? 0) + p.quantityOnHand * p.unitCost))
    return Array.from(map.entries()).map(([name, value]) => ({ name, value: Math.round(value) })).sort((a, b) => b.value - a.value)
  }, [products])

  const salesByMonth = useMemo(() => {
    const months: { key: string; label: string; revenue: number }[] = []
    for (let i = 5; i >= 0; i--) {
      const d = new Date()
      d.setMonth(d.getMonth() - i, 1)
      months.push({ key: `${d.getFullYear()}-${d.getMonth()}`, label: d.toLocaleDateString('en-US', { month: 'short' }), revenue: 0 })
    }
    sales.forEach((s) => {
      const d = new Date(s.createdAt)
      const key = `${d.getFullYear()}-${d.getMonth()}`
      const bucket = months.find((m) => m.key === key)
      if (bucket) bucket.revenue += s.total
    })
    return months
  }, [sales])

  const loanStatusBreakdown = useMemo(() => {
    const counts = { open: 0, 'partially-returned': 0, closed: 0 } as Record<string, number>
    loans.forEach((l) => (counts[l.status] += 1))
    return [
      { name: 'Open', value: counts.open },
      { name: 'Partially Returned', value: counts['partially-returned'] },
      { name: 'Closed', value: counts.closed },
    ]
  }, [loans])

  const poSpendByVendor = useMemo(() => {
    const map = new Map<string, number>()
    purchaseOrders.forEach((po) => {
      const spend = po.lines.reduce((s, l) => s + l.unitCost * l.quantityOrdered, 0)
      map.set(po.vendorId, (map.get(po.vendorId) ?? 0) + spend)
    })
    return Array.from(map.entries()).map(([vendorId, value]) => ({
      vendorId,
      vendorName: vendors.find((v) => v.id === vendorId)?.name ?? vendorId,
      value: Math.round(value),
    }))
  }, [purchaseOrders, vendors])

  const inventoryValue = products.reduce((s, p) => s + p.quantityOnHand * p.unitCost, 0)
  const totalRevenue = sales.reduce((s, sale) => s + sale.total, 0)
  const totalPOSpend = purchaseOrders.reduce((s, po) => s + po.lines.reduce((a, l) => a + l.unitCost * l.quantityOrdered, 0), 0)
  const lostUnits = movements.filter((m) => m.type === 'lost').reduce((s, m) => s + Math.abs(m.quantity), 0)

  return (
    <div>
      <PageHeader title={PAGE_INTROS.reports.title} description={PAGE_INTROS.reports.description} />

      <Tabs defaultValue="inventory">
        <TabsList>
          <TabsTrigger value="inventory">Inventory</TabsTrigger>
          <TabsTrigger value="sales">Sales</TabsTrigger>
          <TabsTrigger value="loans">Loans</TabsTrigger>
          <TabsTrigger value="purchases">Purchases</TabsTrigger>
        </TabsList>

        <TabsContent value="inventory">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 mb-4">
            <StatCard label="Inventory Value" value={formatCurrency(inventoryValue)} icon={DollarSign} />
            <StatCard label="Active SKUs" value={String(products.filter((p) => p.status === 'active').length)} icon={Package} />
            <StatCard label="Units Lost (all time)" value={String(lostUnits)} icon={AlertTriangle} tone="danger" />
          </div>
          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <div>
                <CardTitle>Inventory Value by Category</CardTitle>
                <CardDescription>Current stock valuation at cost, by product category</CardDescription>
              </div>
              <ExportCsvButton
                rows={inventoryByCategory.map((r) => ({ Category: r.name, 'Value at Cost': r.value }))}
                filename={`inventory-value-by-category-${new Date().toISOString().slice(0, 10)}.csv`}
              />
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={340}>
                <BarChart data={inventoryByCategory} margin={{ left: 8, right: 16, bottom: 60 }}>
                  <CartesianGrid stroke={colors.chrome.grid} vertical={false} />
                  <XAxis dataKey="name" stroke={colors.chrome.muted} fontSize={11} angle={-35} textAnchor="end" interval={0} height={80} tickLine={false} axisLine={{ stroke: colors.chrome.axis }} />
                  <YAxis stroke={colors.chrome.muted} fontSize={11} tickLine={false} axisLine={false} width={40} />
                  <Tooltip formatter={(v: number) => formatCurrency(v)} contentStyle={{ background: colors.chrome.surface, border: `1px solid ${colors.chrome.grid}`, borderRadius: 10, fontSize: 12 }} />
                  <Bar dataKey="value" radius={[4, 4, 0, 0]} fill={colors.categorical[0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sales">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 mb-4">
            <StatCard label="Total Revenue" value={formatCurrency(totalRevenue)} icon={DollarSign} tone="success" />
            <StatCard label="Total Sales" value={String(sales.length)} icon={TrendingUp} />
            <StatCard label="Avg Sale Value" value={formatCurrency(Math.round(totalRevenue / (sales.length || 1)))} icon={TrendingUp} tone="accent" />
          </div>
          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <div>
                <CardTitle>Revenue Trend</CardTitle>
                <CardDescription>Sales revenue over the last 6 months</CardDescription>
              </div>
              <ExportCsvButton
                rows={salesByMonth.map((r) => ({ Month: r.label, Revenue: r.revenue }))}
                filename={`sales-revenue-trend-${new Date().toISOString().slice(0, 10)}.csv`}
              />
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={salesByMonth} margin={{ left: -10, right: 16 }}>
                  <CartesianGrid stroke={colors.chrome.grid} vertical={false} />
                  <XAxis dataKey="label" stroke={colors.chrome.muted} fontSize={11} tickLine={false} axisLine={{ stroke: colors.chrome.axis }} />
                  <YAxis stroke={colors.chrome.muted} fontSize={11} tickLine={false} axisLine={false} width={48} />
                  <Tooltip formatter={(v: number) => formatCurrency(v)} contentStyle={{ background: colors.chrome.surface, border: `1px solid ${colors.chrome.grid}`, borderRadius: 10, fontSize: 12 }} />
                  <Line type="monotone" dataKey="revenue" name="Revenue" stroke={colors.categorical[0]} strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="loans">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 mb-4">
            <StatCard label="Total Loans" value={String(loans.length)} icon={HandCoins} />
            <StatCard label="Open Loans" value={String(loans.filter((l) => l.status !== 'closed').length)} icon={HandCoins} tone="warning" />
            <StatCard label="Units Lost on Loan" value={String(lostUnits)} icon={AlertTriangle} tone="danger" />
          </div>
          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <div>
                <CardTitle>Loan Status Breakdown</CardTitle>
                <CardDescription>Distribution of loans by current status</CardDescription>
              </div>
              <ExportCsvButton
                rows={loanStatusBreakdown.map((r) => ({ Status: r.name, Count: r.value }))}
                filename={`loan-status-breakdown-${new Date().toISOString().slice(0, 10)}.csv`}
              />
            </CardHeader>
            <CardContent className="flex flex-col sm:flex-row items-center gap-6">
              <ResponsiveContainer width="100%" height={260} className="sm:max-w-[280px]">
                <PieChart>
                  <Pie data={loanStatusBreakdown} dataKey="value" nameKey="name" innerRadius={55} outerRadius={90} paddingAngle={2}>
                    {loanStatusBreakdown.map((_, i) => (
                      <Cell key={i} fill={colors.categorical[i]} stroke={colors.chrome.surface} strokeWidth={2} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ background: colors.chrome.surface, border: `1px solid ${colors.chrome.grid}`, borderRadius: 10, fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-2">
                {loanStatusBreakdown.map((s, i) => (
                  <div key={s.name} className="flex items-center gap-2 text-sm">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: colors.categorical[i] }} />
                    <span className="text-muted-foreground">{s.name}</span>
                    <span className="font-medium">{s.value}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="purchases">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 mb-4">
            <StatCard label="Total PO Spend" value={formatCurrency(totalPOSpend)} icon={DollarSign} />
            <StatCard label="Total Purchase Orders" value={String(purchaseOrders.length)} icon={ClipboardList} />
            <StatCard
              label="Pending Orders"
              value={String(purchaseOrders.filter((po) => ['draft', 'submitted', 'confirmed', 'partially-received'].includes(po.status)).length)}
              icon={ClipboardList}
              tone="warning"
            />
          </div>
          <Card>
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <div>
                <CardTitle>Spend by Vendor</CardTitle>
                <CardDescription>Total ordered value per vendor across all purchase orders</CardDescription>
              </div>
              <ExportCsvButton
                rows={poSpendByVendor.map((r) => ({ Vendor: r.vendorName, 'Total Spend': r.value }))}
                filename={`po-spend-by-vendor-${new Date().toISOString().slice(0, 10)}.csv`}
              />
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={340}>
                <BarChart data={poSpendByVendor} layout="vertical" margin={{ left: 8, right: 16 }}>
                  <CartesianGrid stroke={colors.chrome.grid} horizontal={false} />
                  <XAxis type="number" stroke={colors.chrome.muted} fontSize={11} tickLine={false} axisLine={false} hide />
                  <YAxis type="category" dataKey="vendorName" stroke={colors.chrome.muted} fontSize={11} tickLine={false} axisLine={false} width={140} />
                  <Tooltip formatter={(v: number) => formatCurrency(v)} contentStyle={{ background: colors.chrome.surface, border: `1px solid ${colors.chrome.grid}`, borderRadius: 10, fontSize: 12 }} />
                  <Bar dataKey="value" radius={[0, 4, 4, 0]} fill={colors.categorical[0]} barSize={18} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
