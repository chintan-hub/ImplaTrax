import { DocumentLayout } from './DocumentLayout'
import type { SaleDocumentData } from './sale'

/**
 * Same source data as SaleDocument (buildSaleDocumentData) — a Delivery
 * Challan is a goods-movement record, not a tax invoice, so pricing is
 * deliberately omitted. The design is intentionally the visual opposite of
 * SaleDocument: dashed rules and an open, form-like signature block instead
 * of the invoice's solid rules and boxed total, so the two are never
 * mistaken for each other even at a glance.
 */
export function DeliveryChallanDocument({ data }: { data: SaleDocumentData }) {
  const totalQuantity = data.lines.reduce((sum, line) => sum + line.quantity, 0)

  return (
    <DocumentLayout
      title="Delivery Challan"
      documentNumber={data.saleNumber}
      kind="challan"
      banner={
        <div className="border-2 border-dashed border-slate-500 px-4 py-3 text-center">
          <p className="text-sm font-bold uppercase tracking-wide text-slate-700">This document is not a tax invoice.</p>
        </div>
      }
      meta={[
        { label: 'Challan No.', value: data.saleNumber, highlight: true },
        { label: 'Dispatch Date', value: data.createdAt, highlight: true },
        { label: 'Patient', value: data.patientName },
        ...(data.caseId ? [{ label: 'Case', value: data.caseId }] : []),
        { label: 'Dispatched By', value: data.soldByName },
      ]}
    >
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b-2 border-dashed border-slate-500 text-left">
            <th className="py-2.5 text-xs font-bold uppercase tracking-wide text-slate-700">Product</th>
            {data.showBatchLot && <th className="py-2.5 text-xs font-bold uppercase tracking-wide text-slate-700">Batch / Lot</th>}
            <th className="py-2.5 text-right text-xs font-bold uppercase tracking-wide text-slate-700">Quantity</th>
          </tr>
        </thead>
        <tbody>
          {data.lines.map((line, i) => (
            <tr key={`${line.sku}-${i}`} className="border-b border-dashed border-slate-300">
              <td className="py-3">
                <p className="font-medium">{line.productName}</p>
                <p className="text-xs text-slate-500">{line.sku}</p>
              </td>
              {data.showBatchLot && <td className="py-3">{line.batchLot ?? '—'}</td>}
              <td className="py-3 text-right text-base font-semibold tabular-nums">{line.quantity}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-dashed border-slate-500">
            <td colSpan={data.showBatchLot ? 2 : 1} className="py-3 text-xs font-bold uppercase tracking-wide text-slate-700">Total Units Dispatched</td>
            <td className="py-3 text-right text-xl font-bold tabular-nums">{totalQuantity}</td>
          </tr>
        </tfoot>
      </table>

      <div className="mt-16 grid grid-cols-2 gap-12">
        <div>
          <div className="h-16 border-b-2 border-slate-900" />
          <p className="mt-2 text-xs font-bold uppercase tracking-wide text-slate-700">Dispatched By</p>
          <p className="text-xs text-slate-400">Name &amp; Signature</p>
        </div>
        <div>
          <div className="h-16 border-b-2 border-slate-900" />
          <p className="mt-2 text-xs font-bold uppercase tracking-wide text-slate-700">Received By</p>
          <p className="text-xs text-slate-400">Name, Signature &amp; Date</p>
        </div>
      </div>
    </DocumentLayout>
  )
}
