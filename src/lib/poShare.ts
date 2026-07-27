import type { Product, PurchaseOrder, Vendor } from '@/types'
import { formatCurrency, formatDate } from '@/lib/utils'

/**
 * Builds the plain-text summary shared by "Copy WhatsApp Message" today and
 * intended for "Generate PDF" / "Print" to reuse once those are built out —
 * one place assembling a Purchase Order's shareable content, not one per
 * export format.
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
