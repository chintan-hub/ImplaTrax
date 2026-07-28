import type { ProductBatch, InventoryMovement, Case, MovementType } from '@/types'

export interface BatchEvent {
  id: string
  kind: MovementType | 'case-usage'
  date: string
  quantity: number
  reference?: string
}

export interface LotSummary {
  productId: string
  lotNumber: string
  totalReceived: number
  /** Derived, never stored — total received plus every signed movement quantity recorded against this lot. */
  remaining: number
  expiryDate?: string
  /** False when a lot was only ever referenced at the point of use (case/sale/loan), never received through the system. */
  hasReceivingRecord: boolean
  /** Chronological, oldest first — the lot's full life story. */
  events: BatchEvent[]
}

/**
 * Aggregates every batch-tracked lot ever referenced — across receiving,
 * sales, loans, and case usage — into one row per (product, lot number).
 * Nothing here is stored; it's recomputed from `batches`/`movements`/`cases`
 * every time, the same "derive, don't duplicate" pattern LoanReturnsPage
 * already uses for its own history view (PROJECT.md §3, Returns).
 *
 * `remaining` only reflects movements that actually change quantityOnHand
 * (receive, sale, loan-out, loan-return, lost). Case usage is included for
 * traceability only and deliberately excluded from that arithmetic, since
 * addImplantToCase does not move stock today — see AUDIT.md's Cases
 * section, finding logged 2026-07-28. A lot referenced only via case usage
 * or a free-text field with no matching ProductBatch record still appears
 * here, flagged with `hasReceivingRecord: false`, rather than being hidden.
 */
export function summarizeLots(batches: ProductBatch[], movements: InventoryMovement[], cases: Case[]): LotSummary[] {
  const key = (productId: string, lotNumber: string) => `${productId}::${lotNumber}`
  const summaries = new Map<string, LotSummary>()

  const ensure = (productId: string, lotNumber: string): LotSummary => {
    const k = key(productId, lotNumber)
    let s = summaries.get(k)
    if (!s) {
      s = { productId, lotNumber, totalReceived: 0, remaining: 0, hasReceivingRecord: false, events: [] }
      summaries.set(k, s)
    }
    return s
  }

  batches.forEach((b) => {
    const s = ensure(b.productId, b.lotNumber)
    s.totalReceived += b.quantity
    s.remaining += b.quantity
    s.hasReceivingRecord = true
    if (!s.expiryDate && b.expiryDate) s.expiryDate = b.expiryDate
    s.events.push({ id: b.id, kind: 'inbound', date: b.receivedAt, quantity: b.quantity, reference: b.reference })
  })

  movements.forEach((m) => {
    if (!m.batchLot || m.type === 'inbound') return // inbound is already represented by its ProductBatch record above
    const s = ensure(m.productId, m.batchLot)
    s.remaining += m.quantity
    s.events.push({ id: m.id, kind: m.type, date: m.createdAt, quantity: m.quantity, reference: m.reference })
  })

  cases.forEach((c) => {
    c.implants.forEach((usage, idx) => {
      if (!usage.batchLot) return
      const s = ensure(usage.productId, usage.batchLot)
      s.events.push({
        id: `${c.id}_implant_${idx}`,
        kind: 'case-usage',
        date: c.createdAt,
        quantity: usage.quantity,
        reference: c.caseId,
      })
    })
  })

  const result = Array.from(summaries.values())
  result.forEach((s) => s.events.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()))
  return result.sort((a, b) => a.lotNumber.localeCompare(b.lotNumber))
}
