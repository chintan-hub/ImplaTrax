import { DocumentLayout } from './DocumentLayout'
import type { LoanDocumentData } from './loan'

export function LoanDocument({ data }: { data: LoanDocumentData }) {
  return (
    <DocumentLayout
      title="Loan Slip"
      documentNumber={data.loanNumber}
      kind="operational"
      meta={[
        { label: 'Loan No.', value: data.loanNumber, highlight: true },
        { label: 'Issued', value: data.issuedAt, highlight: true },
        { label: 'Lab', value: data.labName },
        { label: 'Status', value: data.status },
        ...(data.dueDate ? [{ label: 'Due', value: data.dueDate }] : []),
      ]}
    >
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b-2 border-slate-700 text-left">
            <th className="py-2.5 text-xs font-bold uppercase tracking-wide text-slate-700">Product</th>
            {data.showBatchLot && <th className="py-2.5 text-xs font-bold uppercase tracking-wide text-slate-700">Lot</th>}
            <th className="py-2.5 text-right text-xs font-bold uppercase tracking-wide text-slate-700">Loaned</th>
            <th className="py-2.5 text-right text-xs font-bold uppercase tracking-wide text-slate-700">Returned</th>
            <th className="py-2.5 text-right text-xs font-bold uppercase tracking-wide text-slate-700">Lost</th>
            <th className="py-2.5 text-right text-xs font-bold uppercase tracking-wide text-slate-700">Outstanding</th>
          </tr>
        </thead>
        <tbody>
          {data.lines.map((line, i) => (
            <tr key={`${line.sku}-${i}`} className={`border-b border-slate-200 ${i % 2 === 1 ? 'bg-slate-50' : ''}`}>
              <td className="py-3">
                <p className="font-medium">{line.productName}</p>
                <p className="text-xs text-slate-500">{line.sku}</p>
                {line.lostReason && <p className="text-xs text-slate-500">Lost: {line.lostReason}</p>}
              </td>
              {data.showBatchLot && <td className="py-3">{line.batchLot ?? '—'}</td>}
              <td className="py-3 text-right tabular-nums">{line.quantityLoaned}</td>
              <td className="py-3 text-right tabular-nums">{line.quantityReturned}</td>
              <td className="py-3 text-right tabular-nums">{line.quantityLost}</td>
              <td className="py-3 text-right text-base font-bold tabular-nums">{line.outstanding}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {data.notes && (
        <div className="mt-6 border-t border-slate-200 pt-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Notes</p>
          <p className="mt-1 text-sm">{data.notes}</p>
        </div>
      )}
    </DocumentLayout>
  )
}
