import { DocumentLayout } from './DocumentLayout'
import type { CaseDocumentData } from './case'

export function CaseDocument({ data }: { data: CaseDocumentData }) {
  return (
    <DocumentLayout
      title="Case Summary"
      documentNumber={data.caseId}
      kind="neutral"
      meta={[
        { label: 'Case ID', value: data.caseId, highlight: true },
        { label: 'Date', value: data.createdAt, highlight: true },
        { label: 'Patient', value: data.patientName },
        { label: 'Procedure', value: data.procedure },
        { label: 'Doctor', value: data.doctor },
        ...(data.labName ? [{ label: 'Lab', value: data.labName }] : []),
        { label: 'Status', value: data.status },
        ...(data.scheduledDate ? [{ label: 'Scheduled', value: data.scheduledDate }] : []),
        ...(data.completedDate ? [{ label: 'Completed', value: data.completedDate }] : []),
      ]}
    >
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b-2 border-slate-300 text-left">
            <th className="py-2.5 text-xs font-bold uppercase tracking-wide text-slate-700">Product</th>
            {data.showBatchLot && <th className="py-2.5 text-xs font-bold uppercase tracking-wide text-slate-700">Lot</th>}
            <th className="py-2.5 text-xs font-bold uppercase tracking-wide text-slate-700">Tooth</th>
            <th className="py-2.5 text-right text-xs font-bold uppercase tracking-wide text-slate-700">Quantity</th>
          </tr>
        </thead>
        <tbody>
          {data.implants.length === 0 ? (
            <tr>
              <td colSpan={data.showBatchLot ? 4 : 3} className="py-4 text-slate-500">
                No implants recorded for this case yet.
              </td>
            </tr>
          ) : (
            data.implants.map((line, i) => (
              <tr key={`${line.sku}-${i}`} className={`border-b border-slate-200 ${i % 2 === 1 ? 'bg-slate-50' : ''}`}>
                <td className="py-3">
                  <p className="font-medium">{line.productName}</p>
                  <p className="text-xs text-slate-500">{line.sku}</p>
                </td>
                {data.showBatchLot && <td className="py-3">{line.batchLot ?? '—'}</td>}
                <td className="py-3">{line.tooth}</td>
                <td className="py-3 text-right tabular-nums">{line.quantity}</td>
              </tr>
            ))
          )}
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
