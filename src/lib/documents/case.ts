import type { Case, Product, Patient, Lab } from '@/types'
import { formatDate } from '@/lib/utils'
import { patientFullName } from '@/mocks/patients'

const STATUS_LABEL: Record<Case['status'], string> = {
  planning: 'Planning',
  'surgery-scheduled': 'Surgery Scheduled',
  'in-progress': 'In Progress',
  restoration: 'Restoration',
  completed: 'Completed',
  cancelled: 'Cancelled',
}

export function buildCaseSummaryText(
  caseRecord: Case,
  patient: Patient | undefined,
  productById: Map<string, Product>,
): string {
  const lines = caseRecord.implants
    .map((usage) => {
      const product = productById.get(usage.productId)
      return `- ${product?.name ?? 'Unknown product'} — Tooth #${usage.tooth}, Qty ${usage.quantity}`
    })
    .join('\n')

  return [
    `Case ${caseRecord.caseId}`,
    `Patient: ${patient ? patientFullName(patient) : 'Unknown patient'}`,
    `Procedure: ${caseRecord.procedure}`,
    `Doctor: ${caseRecord.doctor}`,
    `Status: ${STATUS_LABEL[caseRecord.status]}`,
    `Date: ${formatDate(caseRecord.createdAt)}`,
    '',
    'Implants used:',
    lines || '(none recorded yet)',
  ].join('\n')
}

export interface CaseDocumentImplantLine {
  productName: string
  sku: string
  tooth: string
  quantity: number
  batchLot?: string
}

export interface CaseDocumentData {
  caseId: string
  patientName: string
  procedure: string
  doctor: string
  labName?: string
  status: string
  createdAt: string
  scheduledDate?: string
  completedDate?: string
  implants: CaseDocumentImplantLine[]
  notes?: string
  showBatchLot: boolean
}

export function buildCaseDocumentData(
  caseRecord: Case,
  patient: Patient | undefined,
  lab: Lab | undefined,
  productById: Map<string, Product>,
  showBatchLot: boolean,
): CaseDocumentData {
  const implants: CaseDocumentImplantLine[] = caseRecord.implants.map((usage) => {
    const product = productById.get(usage.productId)
    return {
      productName: product?.name ?? 'Unknown product',
      sku: product?.sku ?? '—',
      tooth: usage.tooth,
      quantity: usage.quantity,
      batchLot: usage.batchLot,
    }
  })

  return {
    caseId: caseRecord.caseId,
    patientName: patient ? patientFullName(patient) : 'Unknown patient',
    procedure: caseRecord.procedure,
    doctor: caseRecord.doctor,
    labName: lab?.name,
    status: STATUS_LABEL[caseRecord.status],
    createdAt: formatDate(caseRecord.createdAt),
    scheduledDate: caseRecord.scheduledDate ? formatDate(caseRecord.scheduledDate) : undefined,
    completedDate: caseRecord.completedDate ? formatDate(caseRecord.completedDate) : undefined,
    implants,
    notes: caseRecord.notes,
    showBatchLot,
  }
}
