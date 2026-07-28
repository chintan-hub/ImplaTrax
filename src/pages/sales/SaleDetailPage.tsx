import { useParams, useNavigate, Link } from 'react-router-dom'
import { ArrowLeft, Receipt } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { EmptyState } from '@/components/shared/EmptyState'
import { useData } from '@/store/DataContext'
import { patientFullName } from '@/mocks/patients'
import { formatCurrency, formatDateTime } from '@/lib/utils'

export function SaleDetailPage() {
  const { saleId } = useParams()
  const navigate = useNavigate()
  const { sales, patients, cases, products, users } = useData()

  const sale = sales.find((s) => s.id === saleId)

  if (!sale) {
    return <EmptyState icon={Receipt} title="Sale not found" action={<Button onClick={() => navigate('/sales')}>Back to Sales</Button>} />
  }

  const patient = sale.patientId ? patients.find((p) => p.id === sale.patientId) : undefined
  const caseRecord = sale.caseId ? cases.find((c) => c.id === sale.caseId) : undefined
  const soldBy = users.find((u) => u.id === sale.soldBy)

  return (
    <div>
      <button onClick={() => navigate('/sales')} className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-3.5 w-3.5" /> Back to Sales
      </button>

      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight font-mono">{sale.saleNumber}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {patient ? patientFullName(patient) : 'Direct sale'} · {formatDateTime(sale.createdAt)}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Line Items</CardTitle>
              <CardDescription>{sale.lines.length} product{sale.lines.length !== 1 ? 's' : ''} on this sale</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead>Batch / Lot</TableHead>
                    <TableHead className="text-right">Quantity</TableHead>
                    <TableHead className="text-right">Unit Price</TableHead>
                    <TableHead className="text-right">Line Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sale.lines.map((line, i) => {
                    const product = products.find((p) => p.id === line.productId)
                    return (
                      <TableRow key={i}>
                        <TableCell>
                          <p className="font-medium">{product?.name ?? 'Unknown product'}</p>
                          <p className="text-xs text-muted-foreground">{product?.sku}</p>
                        </TableCell>
                        <TableCell className="text-muted-foreground">{line.batchLot ?? '—'}</TableCell>
                        <TableCell className="text-right tabular-nums">{line.quantity}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatCurrency(line.unitPrice)}</TableCell>
                        <TableCell className="text-right tabular-nums font-medium">{formatCurrency(line.unitPrice * line.quantity)}</TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
              <Separator className="my-3" />
              <p className="text-right text-sm font-semibold">Total: {formatCurrency(sale.total)}</p>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Sale Info</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div>
                <p className="text-muted-foreground">Patient</p>
                {patient ? (
                  <Link to={`/patients/${patient.id}`} className="font-medium text-primary hover:underline">
                    {patientFullName(patient)}
                  </Link>
                ) : <p className="font-medium text-muted-foreground">Direct sale (no patient)</p>}
              </div>
              <div>
                <p className="text-muted-foreground">Case</p>
                {caseRecord ? (
                  <Link to={`/cases/${caseRecord.id}`} className="font-medium text-primary hover:underline font-mono">
                    {caseRecord.caseId}
                  </Link>
                ) : <p className="font-medium text-muted-foreground">No case</p>}
              </div>
              <Separator />
              <div>
                <p className="text-muted-foreground">Sold By</p>
                <p className="font-medium">{soldBy?.name ?? 'Unknown'}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Date</p>
                <p className="font-medium">{formatDateTime(sale.createdAt)}</p>
              </div>
              <Separator />
              <div>
                <p className="text-muted-foreground">Total</p>
                <p className="font-medium">{formatCurrency(sale.total)}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
