import type { PurchaseOrder, PurchaseOrderLine, POStatus } from '@/types'
import { vendors } from './vendors'
import { products } from './products'
import { ri, pick, pickMany, chance, iso, daysAgo, daysFromNow, pad } from './rng'

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

let counter = 0
function nextPoNumber(year: number) {
  counter += 1
  return `PO-${year}-${pad(counter, 4)}`
}

export const purchaseOrders: PurchaseOrder[] = Array.from({ length: 24 }).map((_, i) => {
  const vendor = pick(vendors)
  const vendorProducts = products.filter((p) => vendor.manufacturers.includes(p.manufacturer))
  const pool = vendorProducts.length >= 3 ? vendorProducts : products
  const status = weightedStatus()
  const createdAt = daysAgo(ri(2, 300))
  const year = createdAt.getFullYear()
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

  return {
    id: `po_${i + 1}`,
    poNumber: nextPoNumber(year),
    vendorId: vendor.id,
    status,
    eta,
    createdAt: iso(createdAt),
    submittedAt: status !== 'draft' ? iso(daysAgo(ri(1, 250))) : undefined,
    receivedAt: status === 'received' ? iso(daysAgo(ri(0, 30))) : undefined,
    lines,
    notes: chance(0.2) ? 'Standard replenishment purchase order based on reorder point.' : undefined,
  }
})

export function poById(id: string) {
  return purchaseOrders.find((p) => p.id === id)
}

export function poTotal(po: PurchaseOrder) {
  return po.lines.reduce((sum, l) => sum + l.unitCost * l.quantityOrdered, 0)
}
