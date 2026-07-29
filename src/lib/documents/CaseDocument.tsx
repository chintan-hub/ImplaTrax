import { DocumentLayout } from './DocumentLayout'
import type { CaseDocumentData } from './case'

export function CaseDocument({ data }: { data: CaseDocumentData }) {
  return (
    <DocumentLayout
      title="Case Summary"
      documentNumber={data.caseId}
      meta={[
        { label: 'Patient', value: data.patientName },
        { label: 'Procedure', value: data.procedure },
        { label: 'Doctor', value: data.doctor },
        ...(data.labName ? [{ label: 'Lab', value: data.labName }] : []),
        { label: 'Status', value: data.status },
        { label: 'Date', value: data.createdAt },
        ...(data.scheduledDate ? [{ label: 'Scheduled', value: data.scheduledDate }] : []),
        ...(data.completedDate ? [{ label: 'Completed', value: data.completedDate }] : []),
      ]}
    >
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-border text-left">
            <th className="py-2 font-medium">Product</th>
            {data.showBatchLot && <th className="py-2 font-medium">Lot</th>}
            <th className="py-2 font-medium">Tooth</th>
            <th className="py-2 text-right font-medium">Quantity</th>
          </tr>
        </thead>
        <tbody>
          {data.implants.length === 0 ? (
            <tr>
              <td colSpan={data.showBatchLot ? 4 : 3} className="py-3 text-muted-foreground">
                No implants recorded for this case yet.
              </td>
            </tr>
          ) : (
            data.implants.map((line, i) => (
              <tr key={`${line.sku}-${i}`} className="border-b border-border">
                <td className="py-2">
                  <p className="font-medium">{line.productName}</p>
                  <p className="text-xs text-muted-foreground">{line.sku}</p>
                </td>
                {data.showBatchLot && <td className="py-2">{line.batchLot ?? '—'}</td>}
                <td className="py-2">{line.tooth}</td>
                <td className="py-2 text-right tabular-nums">{line.quantity}</td>
              </tr>
            ))
          )}
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
