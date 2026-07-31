import { DocumentLayout } from './DocumentLayout'
import { formatCurrency } from '@/lib/utils'
import type { PurchaseOrderDocumentData } from './purchaseOrder'

export function PurchaseOrderDocument({ data }: { data: PurchaseOrderDocumentData }) {
  return (
    <DocumentLayout
      title="Purchase Order"
      documentNumber={data.poNumber}
      kind="invoice"
      meta={[
        { label: 'PO No.', value: data.poNumber, highlight: true },
        { label: 'Order Date', value: data.createdAt, highlight: true },
        { label: 'Vendor', value: data.vendorName },
        { label: 'Status', value: data.status },
        { label: 'Expected Delivery', value: data.eta },
      ]}
    >
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b-2 border-slate-900 text-left">
            <th className="py-2.5 text-xs font-bold uppercase tracking-wide text-slate-700">Product</th>
            <th className="py-2.5 text-right text-xs font-bold uppercase tracking-wide text-slate-700">Ordered</th>
            <th className="py-2.5 text-right text-xs font-bold uppercase tracking-wide text-slate-700">Received</th>
            <th className="py-2.5 text-right text-xs font-bold uppercase tracking-wide text-slate-700">Unit Cost</th>
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
              <td className="py-3 text-right tabular-nums">{line.quantityOrdered}</td>
              <td className="py-3 text-right tabular-nums">{line.quantityReceived}</td>
              <td className="py-3 text-right tabular-nums">{formatCurrency(line.unitCost)}</td>
              <td className="py-3 text-right tabular-nums font-medium">{formatCurrency(line.lineTotal)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="mt-6 flex justify-end">
        <div className="w-72 rounded-lg border-2 border-slate-900 px-5 py-4">
          <div className="flex items-baseline justify-between">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Order Total</p>
            <p className="text-3xl font-bold tracking-tight">{formatCurrency(data.total)}</p>
          </div>
        </div>
      </div>

      {data.notes && (
        <div className="mt-6 border-t border-slate-200 pt-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Notes</p>
          <p className="mt-1 text-sm">{data.notes}</p>
        </div>
      )}
    </DocumentLayout>
  )
}
