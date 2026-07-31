import { DocumentLayout } from './DocumentLayout'
import { useCurrencyFormat } from '@/hooks/useCurrencyFormat'
import type { SaleDocumentData } from './sale'

export function SaleDocument({ data }: { data: SaleDocumentData }) {
  const { format } = useCurrencyFormat()
  return (
    <DocumentLayout
      title="Sales Invoice"
      documentNumber={data.saleNumber}
      kind="invoice"
      meta={[
        { label: 'Invoice No.', value: data.saleNumber, highlight: true },
        { label: 'Invoice Date', value: data.createdAt, highlight: true },
        { label: 'Patient', value: data.patientName },
        ...(data.caseId ? [{ label: 'Case', value: data.caseId }] : []),
        { label: 'Sold By', value: data.soldByName },
      ]}
    >
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b-2 border-slate-900 text-left">
            <th className="py-2.5 text-xs font-bold uppercase tracking-wide text-slate-700">Product</th>
            {data.showBatchLot && <th className="py-2.5 text-xs font-bold uppercase tracking-wide text-slate-700">Batch / Lot</th>}
            <th className="py-2.5 text-right text-xs font-bold uppercase tracking-wide text-slate-700">Qty</th>
            <th className="py-2.5 text-right text-xs font-bold uppercase tracking-wide text-slate-700">Unit Price</th>
            <th className="py-2.5 text-right text-xs font-bold uppercase tracking-wide text-slate-700">Line Total</th>
          </tr>
        </thead>
        <tbody>
          {data.lines.map((line, i) => (
            <tr key={`${line.sku}-${i}`} className={`border-b border-slate-200 ${i % 2 === 1 ? 'bg-slate-50' : ''}`}>
              <td className="py-3">
                <p className="font-medium">{line.productName}</p>
                <p className="text-xs text-slate-500">{line.sku}</p>
              </td>
              {data.showBatchLot && <td className="py-3">{line.batchLot ?? '—'}</td>}
              <td className="py-3 text-right tabular-nums">{line.quantity}</td>
              <td className="py-3 text-right tabular-nums">{format(line.unitPrice)}</td>
              <td className="py-3 text-right tabular-nums font-medium">{format(line.lineTotal)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="mt-6 flex justify-end">
        <div className="w-72 rounded-lg border-2 border-slate-900 px-5 py-4">
          <div className="flex items-baseline justify-between">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Amount Due</p>
            <p className="text-3xl font-bold tracking-tight">{format(data.total)}</p>
          </div>
        </div>
      </div>
    </DocumentLayout>
  )
}
