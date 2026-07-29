import { useParams, useNavigate, Link } from 'react-router-dom'
import { toast } from 'sonner'
import { ArrowLeft, HandCoins, MessageCircle, Printer, FileText } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { EmptyState } from '@/components/shared/EmptyState'
import { TermHint } from '@/components/ui/help-tooltip'
import { LoanStatusActions } from '@/components/loans/LoanStatusActions'
import { useData } from '@/store/DataContext'
import { formatDate, formatDateTime } from '@/lib/utils'
import { buildLoanSummaryText, buildLoanDocumentData } from '@/lib/documents/loan'
import { LoanDocument } from '@/lib/documents/LoanDocument'

export function LoanDetailPage() {
  const { loanId } = useParams()
  const navigate = useNavigate()
  const { loans, labs, products, clinicSettings } = useData()

  const loan = loans.find((l) => l.id === loanId)

  if (!loan) {
    return <EmptyState icon={HandCoins} title="Loan not found" action={<Button onClick={() => navigate('/loans')}>Back to Loans</Button>} />
  }

  const lab = labs.find((l) => l.id === loan.labId)
  const history = [...loan.history].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
  const productById = new Map(products.map((p) => [p.id, p]))

  const handleCopyWhatsApp = async () => {
    const text = buildLoanSummaryText(loan, lab, productById)
    try {
      await navigator.clipboard.writeText(text)
      toast.success('Copied to clipboard', { description: 'Paste it into WhatsApp to share this loan.' })
    } catch {
      toast.error('Could not access the clipboard in this browser.')
    }
  }

  const handlePrint = () => {
    const previousTitle = document.title
    document.title = loan.loanNumber
    const restoreTitle = () => {
      document.title = previousTitle
      window.removeEventListener('afterprint', restoreTitle)
    }
    window.addEventListener('afterprint', restoreTitle)
    window.print()
  }

  return (
    <div>
      <div className="print:hidden">
      <button onClick={() => navigate('/loans')} className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-3.5 w-3.5" /> Back to Loans
      </button>

      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight font-mono">
            {loan.loanNumber}
            <TermHint term="loan" iconOnly className="font-sans" />
            <StatusBadge status={loan.status} />
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">{lab?.name ?? 'Unknown lab'} · Issued {formatDate(loan.issuedAt)}</p>
        </div>
        <LoanStatusActions loan={loan} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Line Items</CardTitle>
              <CardDescription>{loan.lines.length} product{loan.lines.length !== 1 ? 's' : ''} on this loan</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    {clinicSettings.batchLotTrackingEnabled && <TableHead>Lot</TableHead>}
                    <TableHead className="text-right">Loaned</TableHead>
                    <TableHead className="text-right">Returned</TableHead>
                    <TableHead className="text-right">Lost</TableHead>
                    <TableHead className="text-right">Outstanding</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loan.lines.map((line) => {
                    const product = products.find((p) => p.id === line.productId)
                    const outstanding = line.quantityLoaned - line.quantityReturned - line.quantityLost
                    return (
                      <TableRow key={line.id}>
                        <TableCell>
                          <p className="font-medium">{product?.name ?? 'Unknown product'}</p>
                          <p className="text-xs text-muted-foreground">{product?.sku}</p>
                          {line.lostReason && <p className="mt-0.5 text-xs text-danger-600">Lost: {line.lostReason}</p>}
                        </TableCell>
                        {clinicSettings.batchLotTrackingEnabled && <TableCell className="text-muted-foreground">{line.batchLot ?? '—'}</TableCell>}
                        <TableCell className="text-right tabular-nums">{line.quantityLoaned}</TableCell>
                        <TableCell className="text-right tabular-nums">{line.quantityReturned}</TableCell>
                        <TableCell className="text-right tabular-nums">{line.quantityLost}</TableCell>
                        <TableCell className="text-right tabular-nums">
                          <Badge variant={outstanding === 0 ? 'success' : 'warning'}>{outstanding}</Badge>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>History</CardTitle>
              <CardDescription>Complete audit trail for this loan — every entry is permanent</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="relative space-y-6 pl-6 before:absolute before:left-[7px] before:top-1 before:h-[calc(100%-8px)] before:w-px before:bg-border">
                {history.map((evt) => (
                  <div key={evt.id} className="relative">
                    <span className="absolute -left-6 top-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-primary ring-4 ring-primary/15" />
                    <p className="text-sm font-medium">{evt.label}</p>
                    <p className="mt-0.5 text-sm text-muted-foreground">{evt.description}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{formatDateTime(evt.date)} · {evt.actor}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Lab & Dates</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div>
                <p className="text-muted-foreground">Lab</p>
                {lab ? (
                  <Link to={`/labs/${lab.id}`} className="font-medium text-primary hover:underline">{lab.name}</Link>
                ) : <p className="font-medium text-muted-foreground">Unknown lab</p>}
              </div>
              <Separator />
              <div>
                <p className="text-muted-foreground">Issued</p>
                <p className="font-medium">{formatDate(loan.issuedAt)}</p>
              </div>
              {loan.dueDate && (
                <div>
                  <p className="text-muted-foreground">Due</p>
                  <p className="font-medium">{formatDate(loan.dueDate)}</p>
                </div>
              )}
              {loan.closedAt && (
                <div>
                  <p className="text-muted-foreground">Closed</p>
                  <p className="font-medium">{formatDate(loan.closedAt)}</p>
                </div>
              )}
              {loan.notes && (
                <>
                  <Separator />
                  <div>
                    <p className="text-muted-foreground">Notes</p>
                    <p className="mt-1 text-sm">{loan.notes}</p>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Share & Export</CardTitle>
              <CardDescription>Send or save this loan</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-2">
                <Button variant="outline" size="sm" onClick={handleCopyWhatsApp}>
                  <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
                </Button>
                <Button variant="outline" size="sm" onClick={handlePrint}>
                  <Printer className="h-3.5 w-3.5" /> Print
                </Button>
                <Button variant="outline" size="sm" className="col-span-2" onClick={handlePrint}>
                  <FileText className="h-3.5 w-3.5" /> Generate PDF
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
      </div>

      <div className="hidden print:block">
        <LoanDocument data={buildLoanDocumentData(loan, lab, productById, clinicSettings.batchLotTrackingEnabled)} />
      </div>
    </div>
  )
}
