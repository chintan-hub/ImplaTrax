import { DocumentLayout } from './DocumentLayout'
import type { LoanDocumentData } from './loan'

export function LoanDocument({ data }: { data: LoanDocumentData }) {
  return (
    <DocumentLayout
      title="Loan Slip"
      documentNumber={data.loanNumber}
      meta={[
        { label: 'Lab', value: data.labName },
        { label: 'Status', value: data.status },
        { label: 'Issued', value: data.issuedAt },
        ...(data.dueDate ? [{ label: 'Due', value: data.dueDate }] : []),
      ]}
    >
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-border text-left">
            <th className="py-2 font-medium">Product</th>
            {data.showBatchLot && <th className="py-2 font-medium">Lot</th>}
            <th className="py-2 text-right font-medium">Loaned</th>
            <th className="py-2 text-right font-medium">Returned</th>
            <th className="py-2 text-right font-medium">Lost</th>
            <th className="py-2 text-right font-medium">Outstanding</th>
          </tr>
        </thead>
        <tbody>
          {data.lines.map((line, i) => (
            <tr key={`${line.sku}-${i}`} className="border-b border-border">
              <td className="py-2">
                <p className="font-medium">{line.productName}</p>
                <p className="text-xs text-muted-foreground">{line.sku}</p>
                {line.lostReason && <p className="text-xs text-muted-foreground">Lost: {line.lostReason}</p>}
              </td>
              {data.showBatchLot && <td className="py-2">{line.batchLot ?? '—'}</td>}
              <td className="py-2 text-right tabular-nums">{line.quantityLoaned}</td>
              <td className="py-2 text-right tabular-nums">{line.quantityReturned}</td>
              <td className="py-2 text-right tabular-nums">{line.quantityLost}</td>
              <td className="py-2 text-right tabular-nums font-medium">{line.outstanding}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {data.notes && (
        <div className="mt-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Notes</p>
          <p className="mt-1 text-sm">{data.notes}</p>
        </div>
      )}
    </DocumentLayout>
  )
}
