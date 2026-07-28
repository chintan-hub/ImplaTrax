import type { ProductBatch } from '@/types'
import { purchaseOrders } from './purchaseOrders'
import { productById } from './products'
import { ri, chance, iso, daysFromNow } from './rng'

/**
 * Development/testing-only seed data (see PROJECT.md §2b, Production Data
 * Policy) — batches are derived from received Purchase Order lines for
 * batch-tracked products, so seeded data tells the same consistent
 * traceability story the real receiving flow now enforces: a batch-tracked
 * product's lot always originates at receiving.
 *
 * `batchLotByPoLine` is exported so mocks/inventory.ts can attach the exact
 * same lot number to the corresponding inbound movement, rather than
 * independently re-rolling a random lot and risking the two disagreeing.
 */
export const batchLotByPoLine = new Map<string, string>()

const batches: ProductBatch[] = []
let seq = 1

purchaseOrders.forEach((po) => {
  po.lines.forEach((line) => {
    if (line.quantityReceived <= 0) return
    const product = productById(line.productId)
    if (!product?.batchTracked) return

    const lotNumber = `LOT-${ri(10000, 99999)}`
    batchLotByPoLine.set(line.id, lotNumber)

    batches.push({
      id: `batch_${seq++}`,
      productId: line.productId,
      lotNumber,
      expiryDate: chance(0.7) ? iso(daysFromNow(ri(90, 900))) : undefined,
      quantity: line.quantityReceived,
      receivedAt: po.receivedAt ?? po.eta,
      reference: po.poNumber,
    })
  })
})

export { batches }
