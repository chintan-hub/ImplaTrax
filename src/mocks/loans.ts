import type { Loan, LoanLine, LoanStatus, LoanEvent, LoanReturnRecord } from '@/types'
import { labs } from './labs'
import { products } from './products'
import { users } from './users'
import { ri, pick, pickMany, chance, iso, daysAgo, pad } from './rng'

const LOANABLE = products.filter((p) =>
  ['Implant Fixture', 'Healing Abutment', 'Final Abutment', 'Impression Coping', 'Analog', 'Surgical Kit', 'Prosthetic Screw'].includes(p.category),
)

const LOST_REASONS = [
  'Component dropped and contaminated during chairside try-in.',
  'Sterilization tray misplaced at lab, item unrecoverable.',
  'Damaged during shipping return to clinic.',
  'Lost in lab transfer between departments.',
  'Component discarded in error during case cleanup.',
]

const STATUS_WEIGHTS: { status: LoanStatus; weight: number }[] = [
  { status: 'open', weight: 35 },
  { status: 'partially-returned', weight: 25 },
  { status: 'closed', weight: 40 },
]

function weightedStatus(): LoanStatus {
  const total = STATUS_WEIGHTS.reduce((s, c) => s + c.weight, 0)
  let r = ri(1, total)
  for (const c of STATUS_WEIGHTS) {
    r -= c.weight
    if (r <= 0) return c.status
  }
  return 'open'
}

let counter = 0
function nextLoanNumber(year: number) {
  counter += 1
  return `LN-${year}-${pad(counter, 5)}`
}

export const loans: Loan[] = []
export const loanReturns: LoanReturnRecord[] = []

for (let i = 0; i < 40; i++) {
  const issuedAt = daysAgo(ri(2, 500))
  const year = issuedAt.getFullYear()
  const status = weightedStatus()
  const lab = pick(labs)
  const lineCount = ri(1, 4)
  const chosenProducts = pickMany(LOANABLE, Math.min(lineCount, LOANABLE.length))

  const lines: LoanLine[] = chosenProducts.map((p, li) => {
    const quantityLoaned = ri(1, 6)
    let quantityReturned = 0
    let quantityLost = 0
    let lostReason: string | undefined

    if (status === 'closed') {
      quantityLost = chance(0.12) ? ri(1, Math.min(2, quantityLoaned)) : 0
      quantityReturned = quantityLoaned - quantityLost
      if (quantityLost > 0) lostReason = pick(LOST_REASONS)
    } else if (status === 'partially-returned') {
      quantityReturned = ri(1, Math.max(1, quantityLoaned - 1))
      quantityLost = chance(0.15) ? 1 : 0
      quantityReturned = Math.min(quantityReturned, quantityLoaned - quantityLost)
      if (quantityLost > 0) lostReason = pick(LOST_REASONS)
    }
    // open: both stay 0

    return {
      id: `ln_${i + 1}_line_${li + 1}`,
      productId: p.id,
      quantityLoaned,
      quantityReturned,
      quantityLost,
      lostReason,
      batchLot: p.batchTracked ? `LOT-${ri(10000, 99999)}` : undefined,
    }
  })

  const closedAt = status === 'closed' ? iso(daysAgo(ri(0, 200))) : undefined
  const dueDate = chance(0.7) ? iso(new Date(issuedAt.getTime() + ri(14, 90) * 86400000)) : undefined

  // Append-only history, mirroring the Purchase Order mock generator: one
  // "Loan Issued" event always, plus one summary event if the seeded status
  // implies a return has already happened.
  const actor = () => pick(users).name
  const totalReturned = lines.reduce((s, l) => s + l.quantityReturned, 0)
  const totalLost = lines.reduce((s, l) => s + l.quantityLost, 0)
  const returnEventAt = status === 'closed' ? closedAt! : status === 'partially-returned' ? iso(daysAgo(ri(0, 120))) : undefined

  const history: LoanEvent[] = [
    { id: `ln_${i + 1}_evt_issued`, loanId: `ln_${i + 1}`, label: 'Loan Issued', description: `Loan issued to ${lab.name} with ${lines.length} product line(s).`, date: iso(issuedAt), actor: actor() },
  ]
  if (status === 'closed') {
    history.push({ id: `ln_${i + 1}_evt_closed`, loanId: `ln_${i + 1}`, label: 'Loan Closed', description: `${totalReturned} returned, ${totalLost} lost in this return; all outstanding items are now accounted for.`, date: returnEventAt!, actor: actor() })
  } else if (status === 'partially-returned') {
    history.push({ id: `ln_${i + 1}_evt_partial`, loanId: `ln_${i + 1}`, label: 'Partial Return Recorded', description: `${totalReturned} returned, ${totalLost} lost in this return; some items remain outstanding.`, date: returnEventAt!, actor: actor() })
  }

  const loan: Loan = {
    id: `ln_${i + 1}`,
    loanNumber: nextLoanNumber(year),
    labId: lab.id,
    status,
    lines,
    issuedBy: pick(users).id,
    issuedAt: iso(issuedAt),
    dueDate,
    closedAt,
    notes: chance(0.2) ? 'Loan issued for try-in and verification prior to final restoration delivery.' : undefined,
    history,
  }
  loans.push(loan)

  lines.forEach((line) => {
    if (line.quantityReturned > 0 || line.quantityLost > 0) {
      loanReturns.push({
        id: `${loan.id}_ret_${line.id}`,
        loanId: loan.id,
        productId: line.productId,
        quantityReturned: line.quantityReturned,
        quantityLost: line.quantityLost,
        lostReason: line.lostReason,
        receivedBy: pick(users).id,
        createdAt: closedAt ?? iso(daysAgo(ri(0, 120))),
      })
    }
  })
}

export function openLoanValue(loan: Loan) {
  return loan.lines.reduce((sum, l) => sum + (l.quantityLoaned - l.quantityReturned - l.quantityLost), 0)
}
