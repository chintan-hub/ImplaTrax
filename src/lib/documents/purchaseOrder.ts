import type { Product, PurchaseOrder, Vendor } from '@/types'
import { formatCurrency, formatDate } from '@/lib/utils'

/**
 * Builds the plain-text summary used by "Copy WhatsApp Message" — one place
 * assembling a Purchase Order's shareable content, not one per export format.
 */
export function buildPOSummaryText(po: PurchaseOrder, vendor: Vendor | undefined, productById: Map<string, Product>): string {
  const total = po.lines.reduce((sum, l) => sum + l.unitCost * l.quantityOrdered, 0)
  const lines = po.lines
    .map((l) => {
      const product = productById.get(l.productId)
      const name = product?.name ?? 'Unknown product'
      return `- ${name} — Qty ${l.quantityOrdered} @ ${formatCurrency(l.unitCost)}`
    })
    .join('\n')

  return [
    `Purchase Order ${po.poNumber}`,
    `Vendor: ${vendor?.name ?? 'Unknown vendor'}`,
    `Status: ${po.status}`,
    `Expected delivery: ${formatDate(po.eta)}`,
    '',
    'Items:',
    lines,
    '',
    `Total: ${formatCurrency(total)}`,
  ].join('\n')
}

export interface PurchaseOrderDocumentLine {
  productName: string
  sku: string
  quantityOrdered: number
  quantityReceived: number
  unitCost: number
  lineTotal: number
}

export interface PurchaseOrderDocumentData {
  poNumber: string
  vendorName: string
  vendorContact: string
  status: string
  eta: string
  createdAt: string
  lines: PurchaseOrderDocumentLine[]
  total: number
  notes?: string
}

function humanizeStatus(status: string): string {
  return status
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

/** Shapes a Purchase Order into the plain data object `PurchaseOrderDocument` renders. */
export function buildPurchaseOrderDocumentData(
  po: PurchaseOrder,
  vendor: Vendor | undefined,
  productById: Map<string, Product>,
): PurchaseOrderDocumentData {
  const lines: PurchaseOrderDocumentLine[] = po.lines.map((l) => {
    const product = productById.get(l.productId)
    return {
      productName: product?.name ?? 'Unknown product',
      sku: product?.sku ?? '—',
      quantityOrdered: l.quantityOrdered,
      quantityReceived: l.quantityReceived,
      unitCost: l.unitCost,
      lineTotal: l.quantityOrdered * l.unitCost,
    }
  })

  return {
    poNumber: po.poNumber,
    vendorName: vendor?.name ?? 'Unknown vendor',
    vendorContact: vendor?.contactName ?? '—',
    status: humanizeStatus(po.status),
    eta: formatDate(po.eta),
    createdAt: formatDate(po.createdAt),
    lines,
    total: lines.reduce((sum, l) => sum + l.lineTotal, 0),
    notes: po.notes,
  }
}
