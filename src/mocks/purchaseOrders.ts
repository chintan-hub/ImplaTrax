import type { PurchaseOrder, PurchaseOrderEvent, PurchaseOrderLine, POStatus } from '@/types'
import { vendors } from './vendors'
import { products } from './products'
import { users } from './users'
import { ri, pick, pickMany, chance, iso, daysAgo, daysFromNow } from './rng'
import { createTimestampIdGenerator } from '@/lib/idGenerator'

const STATUS_WEIGHTS: { status: POStatus; weight: number }[] = [
  { status: 'draft', weight: 10 },
  { status: 'submitted', weight: 15 },
  { status: 'confirmed', weight: 20 },
  { status: 'partially-received', weight: 15 },
  { status: 'received', weight: 35 },
  { status: 'cancelled', weight: 5 },
]

function weightedStatus(): POStatus {
  const total = STATUS_WEIGHTS.reduce((s, c) => s + c.weight, 0)
  let r = ri(1, total)
  for (const c of STATUS_WEIGHTS) {
    r -= c.weight
    if (r <= 0) return c.status
  }
  return 'draft'
}

const nextPoNumber = createTimestampIdGenerator()

/** Adds days to a given date, capped at "now" so a chain of small forward offsets never lands in the future. */
function addDaysCapped(date: Date, days: number): Date {
  const next = new Date(date.getTime() + days * 86400000)
  const now = new Date()
  return next.getTime() > now.getTime() ? now : next
}

export const purchaseOrders: PurchaseOrder[] = Array.from({ length: 24 }).map((_, i) => {
  const vendor = pick(vendors)
  const vendorProducts = products.filter((p) => vendor.manufacturers.includes(p.manufacturer))
  const pool = vendorProducts.length >= 3 ? vendorProducts : products
  const status = weightedStatus()
  const createdAt = daysAgo(ri(2, 300))
  const lineCount = ri(2, 6)
  const chosen = pickMany(pool, Math.min(lineCount, pool.length))

  const lines: PurchaseOrderLine[] = chosen.map((p, li) => {
    const quantityOrdered = ri(5, 60)
    let quantityReceived = 0
    if (status === 'received') quantityReceived = quantityOrdered
    else if (status === 'partially-received') quantityReceived = ri(1, quantityOrdered - 1)
    return {
      id: `po_${i + 1}_line_${li + 1}`,
      productId: p.id,
      quantityOrdered,
      quantityReceived,
      unitCost: p.unitCost,
    }
  })

  const eta = status === 'received' ? iso(daysAgo(ri(0, 30))) : iso(daysFromNow(ri(-5, 30)))

  // A Purchase Order never changes inventory itself — only receiving does
  // (business rule enforced live in DataContext; mirrored here so seed data
  // tells the same consistent story). Dates chain forward from createdAt so
  // the synthesized history below reads in correct chronological order.
  const hasSubmitted = status !== 'draft'
  const hasConfirmed = ['confirmed', 'partially-received', 'received'].includes(status) || (status === 'cancelled' && chance(0.5))
  const submittedAt = hasSubmitted ? addDaysCapped(createdAt, ri(0, 3)) : undefined
  const confirmedAt = hasConfirmed && submittedAt ? addDaysCapped(submittedAt, ri(1, 4)) : undefined
  const receivedAt = status === 'received' ? addDaysCapped(confirmedAt ?? submittedAt ?? createdAt, ri(1, 10)) : undefined
  const partiallyReceivedAt = status === 'partially-received' ? addDaysCapped(confirmedAt ?? submittedAt ?? createdAt, ri(1, 6)) : undefined
  const cancelledAt = status === 'cancelled' ? addDaysCapped(confirmedAt ?? submittedAt ?? createdAt, ri(0, 3)) : undefined

  const actor = () => pick(users).name
  const history: PurchaseOrderEvent[] = [
    { id: `po_${i + 1}_evt_created`, poId: `po_${i + 1}`, label: 'Purchase Order Created', description: `Draft created for ${vendor.name}.`, date: iso(createdAt), actor: actor() },
  ]
  if (submittedAt) {
    history.push({ id: `po_${i + 1}_evt_submitted`, poId: `po_${i + 1}`, label: 'Submitted to Vendor', description: 'Purchase order sent to the vendor.', date: iso(submittedAt), actor: actor() })
  }
  if (confirmedAt) {
    history.push({ id: `po_${i + 1}_evt_confirmed`, poId: `po_${i + 1}`, label: 'Confirmed by Vendor', description: 'Vendor confirmed the order. Inventory is unaffected until items are received.', date: iso(confirmedAt), actor: actor() })
  }
  if (partiallyReceivedAt) {
    const receivedCount = lines.reduce((s, l) => s + l.quantityReceived, 0)
    history.push({ id: `po_${i + 1}_evt_partial`, poId: `po_${i + 1}`, label: 'Stock Partially Received', description: `${receivedCount} unit(s) received so far; inventory updated accordingly.`, date: iso(partiallyReceivedAt), actor: actor() })
  }
  if (receivedAt) {
    history.push({ id: `po_${i + 1}_evt_received`, poId: `po_${i + 1}`, label: 'Stock Fully Received', description: 'All ordered quantities received; inventory updated.', date: iso(receivedAt), actor: actor() })
  }
  if (cancelledAt) {
    history.push({ id: `po_${i + 1}_evt_cancelled`, poId: `po_${i + 1}`, label: 'Purchase Order Cancelled', description: 'This purchase order was cancelled and will not be received.', date: iso(cancelledAt), actor: actor() })
  }

  return {
    id: `po_${i + 1}`,
    poNumber: nextPoNumber(createdAt),
    vendorId: vendor.id,
    status,
    eta,
    createdAt: iso(createdAt),
    submittedAt: submittedAt ? iso(submittedAt) : undefined,
    confirmedAt: confirmedAt ? iso(confirmedAt) : undefined,
    receivedAt: receivedAt ? iso(receivedAt) : undefined,
    lines,
    notes: chance(0.2) ? 'Standard replenishment purchase order based on reorder point.' : undefined,
    history,
    photoDataUrl: undefined,
  }
})

export function poTotal(po: PurchaseOrder) {
  return po.lines.reduce((sum, l) => sum + l.unitCost * l.quantityOrdered, 0)
}
