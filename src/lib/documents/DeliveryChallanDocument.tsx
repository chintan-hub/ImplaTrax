import { DocumentLayout } from './DocumentLayout'
import type { SaleDocumentData } from './sale'

/**
 * Same source data as SaleDocument (buildSaleDocumentData) — a Delivery
 * Challan is a goods-movement record, not a tax invoice, so pricing is
 * deliberately omitted and a signature line takes its place.
 */
export function DeliveryChallanDocument({ data }: { data: SaleDocumentData }) {
  const totalQuantity = data.lines.reduce((sum, line) => sum + line.quantity, 0)

  return (
    <DocumentLayout
      title="Delivery Challan"
      documentNumber={data.saleNumber}
      meta={[
        { label: 'Patient', value: data.patientName },
        ...(data.caseId ? [{ label: 'Case', value: data.caseId }] : []),
        { label: 'Dispatched By', value: data.soldByName },
        { label: 'Date', value: data.createdAt },
      ]}
    >
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-border text-left">
            <th className="py-2 font-medium">Product</th>
            {data.showBatchLot && <th className="py-2 font-medium">Batch / Lot</th>}
            <th className="py-2 text-right font-medium">Quantity</th>
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
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-3 text-right text-sm font-semibold">Total units: {totalQuantity}</p>
      <p className="mt-2 text-xs text-muted-foreground">This is a delivery record, not a tax invoice — no pricing is shown.</p>

      <div className="mt-10 flex justify-between text-sm">
        <div>
          <div className="w-48 border-t border-border pt-1">Dispatched By</div>
        </div>
        <div>
          <div className="w-48 border-t border-border pt-1">Received By (Signature)</div>
        </div>
      </div>
    </DocumentLayout>
  )
}
