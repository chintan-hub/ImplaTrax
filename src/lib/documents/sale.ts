import type { Sale, Product, Patient, Case } from '@/types'
import { formatCurrency, formatDate } from '@/lib/utils'
import { patientFullName } from '@/mocks/patients'

/**
 * Builds the plain-text summary used by "Copy WhatsApp Message" — mirrors
 * buildPOSummaryText's role for Purchase Orders (src/lib/documents/purchaseOrder.ts).
 */
export function buildSaleSummaryText(
  sale: Sale,
  patient: Patient | undefined,
  caseRecord: Case | undefined,
  productById: Map<string, Product>,
  currency: string,
): string {
  const lines = sale.lines
    .map((l) => {
      const product = productById.get(l.productId)
      return `- ${product?.name ?? 'Unknown product'} — Qty ${l.quantity} @ ${formatCurrency(l.unitPrice, currency)}`
    })
    .join('\n')

  return [
    `Sale ${sale.saleNumber}`,
    `Patient: ${patient ? patientFullName(patient) : 'Direct sale (no patient)'}`,
    caseRecord ? `Case: ${caseRecord.caseId}` : undefined,
    `Date: ${formatDate(sale.createdAt)}`,
    '',
    'Items:',
    lines,
    '',
    `Total: ${formatCurrency(sale.total, currency)}`,
  ].filter((x): x is string => x !== undefined).join('\n')
}

export interface SaleDocumentLine {
  productName: string
  sku: string
  quantity: number
  unitPrice: number
  lineTotal: number
  batchLot?: string
}

export interface SaleDocumentData {
  saleNumber: string
  patientName: string
  caseId?: string
  soldByName: string
  createdAt: string
  lines: SaleDocumentLine[]
  total: number
  showBatchLot: boolean
}

/** Shapes a Sale into the plain data object `SaleDocument` renders. */
export function buildSaleDocumentData(
  sale: Sale,
  patient: Patient | undefined,
  caseRecord: Case | undefined,
  soldByName: string,
  productById: Map<string, Product>,
  showBatchLot: boolean,
): SaleDocumentData {
  const lines: SaleDocumentLine[] = sale.lines.map((l) => {
    const product = productById.get(l.productId)
    return {
      productName: product?.name ?? 'Unknown product',
      sku: product?.sku ?? '—',
      quantity: l.quantity,
      unitPrice: l.unitPrice,
      lineTotal: l.quantity * l.unitPrice,
      batchLot: l.batchLot,
    }
  })

  return {
    saleNumber: sale.saleNumber,
    patientName: patient ? patientFullName(patient) : 'Direct sale (no patient)',
    caseId: caseRecord?.caseId,
    soldByName,
    createdAt: formatDate(sale.createdAt),
    lines,
    total: sale.total,
    showBatchLot,
  }
}
