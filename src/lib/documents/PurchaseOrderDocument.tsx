import { DocumentLayout } from './DocumentLayout'
import { formatCurrency } from '@/lib/utils'
import type { PurchaseOrderDocumentData } from './purchaseOrder'

export function PurchaseOrderDocument({ data }: { data: PurchaseOrderDocumentData }) {
  return (
    <DocumentLayout
      title="Purchase Order"
      documentNumber={data.poNumber}
      meta={[
        { label: 'Vendor', value: data.vendorName },
        { label: 'Status', value: data.status },
        { label: 'Order Date', value: data.createdAt },
        { label: 'Expected Delivery', value: data.eta },
      ]}
    >
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-border text-left">
            <th className="py-2 font-medium">Product</th>
            <th className="py-2 text-right font-medium">Ordered</th>
            <th className="py-2 text-right font-medium">Received</th>
            <th className="py-2 text-right font-medium">Unit Cost</th>
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
              <td className="py-2 text-right tabular-nums">{line.quantityOrdered}</td>
              <td className="py-2 text-right tabular-nums">{line.quantityReceived}</td>
              <td className="py-2 text-right tabular-nums">{formatCurrency(line.unitCost)}</td>
              <td className="py-2 text-right tabular-nums">{formatCurrency(line.lineTotal)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-3 text-right text-base font-semibold">Total: {formatCurrency(data.total)}</p>
      {data.notes && (
        <div className="mt-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Notes</p>
          <p className="mt-1 text-sm">{data.notes}</p>
        </div>
      )}
    </DocumentLayout>
  )
}
