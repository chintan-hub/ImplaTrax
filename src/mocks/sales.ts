import type { Sale, SaleLine } from '@/types'
import { cases } from './cases'
import { products, productById } from './products'
import { users } from './users'
import { ri, pick, iso, daysAgo, pad } from './rng'

const casesWithImplants = cases.filter((c) => c.implants.length > 0)

let counter = 0
function nextSaleNumber(year: number) {
  counter += 1
  return `SL-${year}-${pad(counter, 5)}`
}

export const sales: Sale[] = Array.from({ length: 30 }).map((_, i) => {
  const attachToCase = i < 24 && casesWithImplants.length > 0
  const createdAt = daysAgo(ri(0, 400))
  const year = createdAt.getFullYear()

  let lines: SaleLine[] = []
  let caseId: string | undefined
  let patientId: string | undefined

  if (attachToCase) {
    const c = pick(casesWithImplants)
    caseId = c.id
    patientId = c.patientId
    lines = c.implants.map((usage) => {
      const product = productById(usage.productId)!
      return {
        productId: usage.productId,
        quantity: usage.quantity,
        unitPrice: product.unitPrice,
        batchLot: usage.batchLot,
      }
    })
  } else {
    const lineCount = ri(1, 3)
    const chosen = Array.from({ length: lineCount }).map(() => pick(products))
    lines = chosen.map((p) => ({
      productId: p.id,
      quantity: ri(1, 3),
      unitPrice: p.unitPrice,
    }))
  }

  const total = lines.reduce((sum, l) => sum + l.unitPrice * l.quantity, 0)

  return {
    id: `sal_${i + 1}`,
    saleNumber: nextSaleNumber(year),
    patientId,
    caseId,
    lines,
    total,
    soldBy: pick(users).id,
    createdAt: iso(createdAt),
  }
})
