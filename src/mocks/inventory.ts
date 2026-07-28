import type { InventoryMovement, MovementType } from '@/types'
import { products } from './products'
import { users } from './users'
import { purchaseOrders } from './purchaseOrders'
import { loans } from './loans'
import { sales } from './sales'
import { batchLotByPoLine } from './batches'
import { ri, pick, chance, iso, daysAgo } from './rng'

const ADJUSTMENT_REASONS = [
  'Cycle count adjustment',
  'Damaged in storage',
  'Expired — removed from stock',
  'Found during physical audit',
  'Data entry adjustment',
  'Returned by patient (unused, resterilized)',
  'Transferred from satellite clinic',
]

const movements: InventoryMovement[] = []
let seq = 1

function addMovement(m: Omit<InventoryMovement, 'id'>) {
  movements.push({ id: `mv_${seq++}`, ...m })
}

// Movements derived from received / partially-received POs
purchaseOrders
  .filter((po) => po.status === 'received' || po.status === 'partially-received')
  .forEach((po) => {
    po.lines.forEach((line) => {
      if (line.quantityReceived > 0) {
        addMovement({
          productId: line.productId,
          type: 'inbound',
          quantity: line.quantityReceived,
          reason: 'Purchase order received',
          reference: po.poNumber,
          performedBy: pick(users).id,
          createdAt: po.receivedAt ?? po.eta,
          batchLot: batchLotByPoLine.get(line.id),
        })
      }
    })
  })

// Movements derived from loans (loan-out at issue, loan-return / lost at close)
loans.forEach((loan) => {
  loan.lines.forEach((line) => {
    addMovement({
      productId: line.productId,
      type: 'loan-out',
      quantity: -line.quantityLoaned,
      reason: 'Loan issued to lab',
      reference: loan.loanNumber,
      performedBy: loan.issuedBy,
      createdAt: loan.issuedAt,
      batchLot: line.batchLot,
    })
    if (line.quantityReturned > 0) {
      addMovement({
        productId: line.productId,
        type: 'loan-return',
        quantity: line.quantityReturned,
        reason: 'Loan components returned by lab',
        reference: loan.loanNumber,
        performedBy: loan.issuedBy,
        createdAt: loan.closedAt ?? iso(daysAgo(ri(0, 60))),
        batchLot: line.batchLot,
      })
    }
    if (line.quantityLost > 0) {
      addMovement({
        productId: line.productId,
        type: 'lost',
        quantity: -line.quantityLost,
        reason: line.lostReason ?? 'Component lost while on loan',
        reference: loan.loanNumber,
        performedBy: loan.issuedBy,
        createdAt: loan.closedAt ?? iso(daysAgo(ri(0, 60))),
        batchLot: line.batchLot,
      })
    }
  })
})

// Movements derived from sales
sales.forEach((sale) => {
  sale.lines.forEach((line) => {
    addMovement({
      productId: line.productId,
      type: 'sale',
      quantity: -line.quantity,
      reason: sale.caseId ? 'Used in patient case' : 'Direct sale',
      reference: sale.saleNumber,
      performedBy: sale.soldBy,
      createdAt: sale.createdAt,
      batchLot: line.batchLot,
    })
  })
})

// Manual adjustments to round out to ~150 movements
const targetTotal = 150
while (movements.length < targetTotal) {
  const product = pick(products)
  const isPositive = chance(0.4)
  const quantity = isPositive ? ri(1, 15) : -ri(1, 10)
  addMovement({
    productId: product.id,
    type: 'adjustment',
    quantity,
    reason: pick(ADJUSTMENT_REASONS),
    performedBy: pick(users).id,
    createdAt: iso(daysAgo(ri(0, 400))),
    note: chance(0.3) ? 'Verified by second staff member during count.' : undefined,
  })
}

movements.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
movements.forEach((m, i) => (m.id = `mv_${i + 1}`))

export const inventoryMovements = movements

export function movementsForProduct(productId: string) {
  return inventoryMovements.filter((m) => m.productId === productId)
}

export type { MovementType }
