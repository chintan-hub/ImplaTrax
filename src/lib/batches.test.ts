import { describe, it, expect } from 'vitest'
import { summarizeLots } from './batches'
import type { ProductBatch, InventoryMovement, Case } from '@/types'

function batch(overrides: Partial<ProductBatch> = {}): ProductBatch {
  return {
    id: 'batch_1',
    productId: 'prd_1',
    lotNumber: 'LOT-1',
    quantity: 10,
    receivedAt: '2026-01-01T00:00:00.000Z',
    reference: 'PO-001',
    ...overrides,
  }
}

function movement(overrides: Partial<InventoryMovement> = {}): InventoryMovement {
  return {
    id: 'mv_1',
    productId: 'prd_1',
    type: 'sale',
    quantity: -3,
    quantityBefore: 10,
    quantityAfter: 7,
    reason: 'Direct sale',
    performedBy: 'usr_1',
    createdAt: '2026-01-02T00:00:00.000Z',
    batchLot: 'LOT-1',
    ...overrides,
  }
}

describe('summarizeLots', () => {
  it('a freshly received lot with no consumption has remaining equal to what was received', () => {
    const result = summarizeLots([batch({ quantity: 10 })], [], [])
    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({ productId: 'prd_1', lotNumber: 'LOT-1', totalReceived: 10, remaining: 10, hasReceivingRecord: true })
  })

  it('a sale against the lot reduces remaining but not totalReceived', () => {
    const result = summarizeLots([batch({ quantity: 10 })], [movement({ type: 'sale', quantity: -4 })], [])
    expect(result[0].totalReceived).toBe(10)
    expect(result[0].remaining).toBe(6)
  })

  it('a loan-out reduces remaining, and a matching loan-return restores it', () => {
    const movements: InventoryMovement[] = [
      movement({ id: 'mv_1', type: 'loan-out', quantity: -5, reference: 'LN-001' }),
      movement({ id: 'mv_2', type: 'loan-return', quantity: 5, reference: 'LN-001' }),
    ]
    const result = summarizeLots([batch({ quantity: 10 })], movements, [])
    expect(result[0].remaining).toBe(10)
  })

  it('a lost movement permanently reduces remaining, unlike a return', () => {
    const movements: InventoryMovement[] = [
      movement({ id: 'mv_1', type: 'loan-out', quantity: -5, reference: 'LN-001' }),
      movement({ id: 'mv_2', type: 'lost', quantity: -2, reference: 'LN-001' }),
    ]
    const result = summarizeLots([batch({ quantity: 10 })], movements, [])
    expect(result[0].remaining).toBe(3)
  })

  it('an inbound movement for the same lot is not double-counted on top of its ProductBatch record', () => {
    const movements: InventoryMovement[] = [movement({ id: 'mv_1', type: 'inbound', quantity: 10, reference: 'PO-001' })]
    const result = summarizeLots([batch({ quantity: 10 })], movements, [])
    expect(result[0].totalReceived).toBe(10)
    expect(result[0].remaining).toBe(10)
  })

  it('the same lot number received across multiple receiving events aggregates into one row, summed', () => {
    const batches: ProductBatch[] = [
      batch({ id: 'batch_1', quantity: 10, receivedAt: '2026-01-01T00:00:00.000Z' }),
      batch({ id: 'batch_2', quantity: 5, receivedAt: '2026-02-01T00:00:00.000Z' }),
    ]
    const result = summarizeLots(batches, [], [])
    expect(result).toHaveLength(1)
    expect(result[0].totalReceived).toBe(15)
    expect(result[0].remaining).toBe(15)
  })

  it('a lot referenced only by usage, with no matching ProductBatch, is still surfaced and flagged as having no receiving record', () => {
    const movements: InventoryMovement[] = [movement({ type: 'sale', quantity: -2, batchLot: 'LOT-UNKNOWN' })]
    const result = summarizeLots([], movements, [])
    expect(result).toHaveLength(1)
    expect(result[0].hasReceivingRecord).toBe(false)
    expect(result[0].totalReceived).toBe(0)
    expect(result[0].remaining).toBe(-2)
  })

  it('case usage appears in the events list for traceability but is excluded from the remaining-quantity arithmetic', () => {
    const cases: Case[] = [
      {
        id: 'cse_1',
        caseId: 'IDC-2026-00001',
        patientId: 'pat_1',
        doctor: 'Dr. Test',
        status: 'planning',
        procedure: 'Implant placement',
        createdAt: '2026-01-05T00:00:00.000Z',
        implants: [{ productId: 'prd_1', tooth: '36', quantity: 2, batchLot: 'LOT-1' }],
        history: [],
      },
    ]
    const result = summarizeLots([batch({ quantity: 10 })], [], cases)
    expect(result[0].remaining).toBe(10) // unaffected by case usage
    const caseEvent = result[0].events.find((e) => e.kind === 'case-usage')
    expect(caseEvent).toBeDefined()
    expect(caseEvent?.reference).toBe('IDC-2026-00001')
    expect(caseEvent?.quantity).toBe(2)
  })

  it('events are sorted chronologically, oldest first', () => {
    const movements: InventoryMovement[] = [
      movement({ id: 'mv_2', type: 'sale', quantity: -2, createdAt: '2026-03-01T00:00:00.000Z' }),
      movement({ id: 'mv_1', type: 'loan-out', quantity: -1, createdAt: '2026-02-01T00:00:00.000Z' }),
    ]
    const result = summarizeLots([batch({ quantity: 10, receivedAt: '2026-01-01T00:00:00.000Z' })], movements, [])
    const dates = result[0].events.map((e) => e.date)
    expect(dates).toEqual([...dates].sort((a, b) => new Date(a).getTime() - new Date(b).getTime()))
  })

  it('an expiry date is carried onto the summary when present on the batch record', () => {
    const result = summarizeLots([batch({ expiryDate: '2027-06-01T00:00:00.000Z' })], [], [])
    expect(result[0].expiryDate).toBe('2027-06-01T00:00:00.000Z')
  })

  it('different products with the same lot number are kept as separate rows', () => {
    const batches: ProductBatch[] = [
      batch({ id: 'batch_1', productId: 'prd_1', lotNumber: 'LOT-1', quantity: 10 }),
      batch({ id: 'batch_2', productId: 'prd_2', lotNumber: 'LOT-1', quantity: 7 }),
    ]
    const result = summarizeLots(batches, [], [])
    expect(result).toHaveLength(2)
  })
})
