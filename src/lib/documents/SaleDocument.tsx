import { DocumentLayout } from './DocumentLayout'
import { formatCurrency } from '@/lib/utils'
import type { SaleDocumentData } from './sale'

export function SaleDocument({ data }: { data: SaleDocumentData }) {
  return (
    <DocumentLayout
      title="Sales Invoice"
      documentNumber={data.saleNumber}
      meta={[
        { label: 'Patient', value: data.patientName },
        ...(data.caseId ? [{ label: 'Case', value: data.caseId }] : []),
        { label: 'Sold By', value: data.soldByName },
        { label: 'Date', value: data.createdAt },
      ]}
    >
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-border text-left">
            <th className="py-2 font-medium">Product</th>
            {data.showBatchLot && <th className="py-2 font-medium">Batch / Lot</th>}
            <th className="py-2 text-right font-medium">Qty</th>
            <th className="py-2 text-right font-medium">Unit Price</th>
            <th className="py-2 text-right font-medium">Line Total</th>
          </tr>
        </thead>
        <tbody>
          {data.lines.map((line, i) => (
            <tr key={`${line.sku}-${i}`} className="border-b border-border">
              <td className="py-2">
                <p className="font-medium">{line.productName}</p>
                <p className="text-xs text-muted-foreground">{line.sku}</p>
              </td>
              {data.showBatchLot && <td className="py-2">{line.batchLot ?? '—'}</td>}
              <td className="py-2 text-right tabular-nums">{line.quantity}</td>
              <td className="py-2 text-right tabular-nums">{formatCurrency(line.unitPrice)}</td>
              <td className="py-2 text-right tabular-nums">{formatCurrency(line.lineTotal)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-3 text-right text-base font-semibold">Total: {formatCurrency(data.total)}</p>
    </DocumentLayout>
  )
}
