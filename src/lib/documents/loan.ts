import type { Loan, Product, Lab } from '@/types'
import { formatDate } from '@/lib/utils'

/**
 * Builds the plain-text summary used by "Copy WhatsApp Message" — mirrors
 * buildPOSummaryText's role for Purchase Orders (src/lib/documents/purchaseOrder.ts).
 */
export function buildLoanSummaryText(loan: Loan, lab: Lab | undefined, productById: Map<string, Product>): string {
  const lines = loan.lines
    .map((l) => {
      const product = productById.get(l.productId)
      const outstanding = l.quantityLoaned - l.quantityReturned - l.quantityLost
      return `- ${product?.name ?? 'Unknown product'} — Loaned ${l.quantityLoaned}, Returned ${l.quantityReturned}, Lost ${l.quantityLost}, Outstanding ${outstanding}`
    })
    .join('\n')

  return [
    `Loan ${loan.loanNumber}`,
    `Lab: ${lab?.name ?? 'Unknown lab'}`,
    `Status: ${loan.status}`,
    `Issued: ${formatDate(loan.issuedAt)}`,
    loan.dueDate ? `Due: ${formatDate(loan.dueDate)}` : undefined,
    '',
    'Items:',
    lines,
  ].filter((x): x is string => x !== undefined).join('\n')
}

export interface LoanDocumentLine {
  productName: string
  sku: string
  quantityLoaned: number
  quantityReturned: number
  quantityLost: number
  outstanding: number
  lostReason?: string
  batchLot?: string
}

export interface LoanDocumentData {
  loanNumber: string
  labName: string
  status: string
  issuedAt: string
  dueDate?: string
  lines: LoanDocumentLine[]
  notes?: string
  showBatchLot: boolean
}

function humanizeStatus(status: string): string {
  return status
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

/**
 * Shapes a Loan into the plain data object `LoanDocument` renders. One
 * template serves both moments a clinic needs a physical record: printed at
 * issue time it reads as a loan-out slip, reprinted after returns are
 * recorded it reads as the return receipt — the line data (loaned/returned/
 * lost/outstanding) is always the loan's true current state either way.
 */
export function buildLoanDocumentData(loan: Loan, lab: Lab | undefined, productById: Map<string, Product>, showBatchLot: boolean): LoanDocumentData {
  const lines: LoanDocumentLine[] = loan.lines.map((l) => {
    const product = productById.get(l.productId)
    return {
      productName: product?.name ?? 'Unknown product',
      sku: product?.sku ?? '—',
      quantityLoaned: l.quantityLoaned,
      quantityReturned: l.quantityReturned,
      quantityLost: l.quantityLost,
      outstanding: l.quantityLoaned - l.quantityReturned - l.quantityLost,
      lostReason: l.lostReason,
      batchLot: l.batchLot,
    }
  })

  return {
    loanNumber: loan.loanNumber,
    labName: lab?.name ?? 'Unknown lab',
    status: humanizeStatus(loan.status),
    issuedAt: formatDate(loan.issuedAt),
    dueDate: loan.dueDate ? formatDate(loan.dueDate) : undefined,
    lines,
    notes: loan.notes,
    showBatchLot,
  }
}
