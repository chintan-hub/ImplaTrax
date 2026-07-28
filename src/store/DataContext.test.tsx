import { describe, it, expect } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { DataProvider, useData } from './DataContext'

/**
 * These tests exercise DataContext's mutating actions directly — the part of
 * the app that encodes "every stock-changing action pairs a state update with
 * an audit movement" (see PROJECT.md §2 / ARCHITECTURE.md §6.5). Each test
 * reads whatever the deterministic mock seed produced at call time rather
 * than hardcoding expected values, so they stay valid if the seed generators
 * change.
 */
function setup() {
  return renderHook(() => useData(), { wrapper: DataProvider })
}

describe('adjustStock', () => {
  it('increases quantityOnHand and records a positive adjustment movement', () => {
    const { result } = setup()
    const product = result.current.products[0]
    const before = product.quantityOnHand

    act(() => {
      result.current.adjustStock(product.id, 5, 'Cycle count adjustment')
    })

    const updated = result.current.products.find((p) => p.id === product.id)!
    expect(updated.quantityOnHand).toBe(before + 5)

    const movement = result.current.movements[0]
    expect(movement.productId).toBe(product.id)
    expect(movement.type).toBe('adjustment')
    expect(movement.quantity).toBe(5)
    expect(movement.reason).toBe('Cycle count adjustment')
  })

  it('decreases quantityOnHand and records a negative adjustment movement', () => {
    const { result } = setup()
    const product = result.current.products.find((p) => p.quantityOnHand >= 3)!
    const before = product.quantityOnHand

    act(() => {
      result.current.adjustStock(product.id, -3, 'Damaged in storage')
    })

    const updated = result.current.products.find((p) => p.id === product.id)!
    expect(updated.quantityOnHand).toBe(before - 3)
    expect(result.current.movements[0].quantity).toBe(-3)
  })

  it('never lets quantityOnHand go negative', () => {
    const { result } = setup()
    const product = result.current.products[0]

    act(() => {
      result.current.adjustStock(product.id, -(product.quantityOnHand + 1000), 'Large correction')
    })

    const updated = result.current.products.find((p) => p.id === product.id)!
    expect(updated.quantityOnHand).toBe(0)
  })
})

describe('purchase order lifecycle', () => {
  it('creates a draft PO with zero quantityReceived on each line', () => {
    const { result } = setup()
    const vendor = result.current.vendors[0]
    const product = result.current.products.find((p) => p.vendorId === vendor.id) ?? result.current.products[0]

    let po: ReturnType<typeof result.current.createPurchaseOrder>
    act(() => {
      po = result.current.createPurchaseOrder(vendor.id, [{ productId: product.id, quantityOrdered: 10, unitCost: 5 }], new Date().toISOString())
    })

    expect(po!.status).toBe('draft')
    expect(po!.lines[0].quantityReceived).toBe(0)
    expect(result.current.purchaseOrders.find((p) => p.id === po!.id)).toBeTruthy()
  })

  it('moves to partially-received on a partial receipt and increases stock by the received amount', () => {
    const { result } = setup()
    const vendor = result.current.vendors[0]
    const product = result.current.products[0]
    const before = product.quantityOnHand

    let po: ReturnType<typeof result.current.createPurchaseOrder>
    act(() => {
      po = result.current.createPurchaseOrder(vendor.id, [{ productId: product.id, quantityOrdered: 10, unitCost: 5 }], new Date().toISOString())
    })
    act(() => {
      result.current.submitPurchaseOrder(po!.id)
    })
    act(() => {
      result.current.receivePurchaseOrder(po!.id, [{ lineId: po!.lines[0].id, quantityReceived: 4 }])
    })

    const updatedPo = result.current.purchaseOrders.find((p) => p.id === po!.id)!
    expect(updatedPo.status).toBe('partially-received')
    expect(updatedPo.lines[0].quantityReceived).toBe(4)

    const updatedProduct = result.current.products.find((p) => p.id === product.id)!
    expect(updatedProduct.quantityOnHand).toBe(before + 4)

    const movement = result.current.movements[0]
    expect(movement.type).toBe('inbound')
    expect(movement.quantity).toBe(4)
    expect(movement.reference).toBe(po!.poNumber)
  })

  it('moves to received once every line is fully received', () => {
    const { result } = setup()
    const vendor = result.current.vendors[0]
    const product = result.current.products[0]
    const before = product.quantityOnHand

    let po: ReturnType<typeof result.current.createPurchaseOrder>
    act(() => {
      po = result.current.createPurchaseOrder(vendor.id, [{ productId: product.id, quantityOrdered: 10, unitCost: 5 }], new Date().toISOString())
    })
    act(() => {
      result.current.submitPurchaseOrder(po!.id)
    })
    act(() => {
      result.current.receivePurchaseOrder(po!.id, [{ lineId: po!.lines[0].id, quantityReceived: 4 }])
    })
    act(() => {
      result.current.receivePurchaseOrder(po!.id, [{ lineId: po!.lines[0].id, quantityReceived: 6 }])
    })

    const updatedPo = result.current.purchaseOrders.find((p) => p.id === po!.id)!
    expect(updatedPo.status).toBe('received')
    expect(updatedPo.lines[0].quantityReceived).toBe(10)

    const updatedProduct = result.current.products.find((p) => p.id === product.id)!
    expect(updatedProduct.quantityOnHand).toBe(before + 10)
  })

  it('caps quantityReceived at quantityOrdered even if over-received', () => {
    const { result } = setup()
    const vendor = result.current.vendors[0]
    const product = result.current.products[0]

    let po: ReturnType<typeof result.current.createPurchaseOrder>
    act(() => {
      po = result.current.createPurchaseOrder(vendor.id, [{ productId: product.id, quantityOrdered: 5, unitCost: 5 }], new Date().toISOString())
    })
    act(() => {
      result.current.submitPurchaseOrder(po!.id)
    })
    act(() => {
      result.current.receivePurchaseOrder(po!.id, [{ lineId: po!.lines[0].id, quantityReceived: 999 }])
    })

    const updatedPo = result.current.purchaseOrders.find((p) => p.id === po!.id)!
    expect(updatedPo.lines[0].quantityReceived).toBe(5)
    expect(updatedPo.status).toBe('received')
  })
})

describe('loan lifecycle', () => {
  it('issuing a loan decreases stock and records a loan-out movement', () => {
    const { result } = setup()
    const lab = result.current.labs[0]
    const product = result.current.products.find((p) => p.quantityOnHand >= 5)!
    const before = product.quantityOnHand

    let loan: ReturnType<typeof result.current.createLoan>
    act(() => {
      loan = result.current.createLoan(lab.id, [{ productId: product.id, quantityLoaned: 5 }])
    })

    expect(loan!.status).toBe('open')
    expect(loan!.labId).toBe(lab.id)

    const updatedProduct = result.current.products.find((p) => p.id === product.id)!
    expect(updatedProduct.quantityOnHand).toBe(before - 5)

    const movement = result.current.movements[0]
    expect(movement.type).toBe('loan-out')
    expect(movement.quantity).toBe(-5)
    expect(movement.reference).toBe(loan!.loanNumber)
  })

  it('a partial return moves status to partially-returned and restores stock for the returned quantity only', () => {
    const { result } = setup()
    const lab = result.current.labs[0]
    const product = result.current.products.find((p) => p.quantityOnHand >= 5)!
    const afterLoan = product.quantityOnHand - 5

    let loan: ReturnType<typeof result.current.createLoan>
    act(() => {
      loan = result.current.createLoan(lab.id, [{ productId: product.id, quantityLoaned: 5 }])
    })
    act(() => {
      result.current.returnLoanLines(loan!.id, [{ lineId: loan!.lines[0].id, quantityReturned: 3, quantityLost: 0 }])
    })

    const updatedLoan = result.current.loans.find((l) => l.id === loan!.id)!
    expect(updatedLoan.status).toBe('partially-returned')

    const updatedProduct = result.current.products.find((p) => p.id === product.id)!
    expect(updatedProduct.quantityOnHand).toBe(afterLoan + 3)

    const returnMovement = result.current.movements.find((m) => m.type === 'loan-return')!
    expect(returnMovement.quantity).toBe(3)
  })

  it('closes the loan once returned + lost accounts for the full loaned quantity, and lost quantity does not restore stock', () => {
    const { result } = setup()
    const lab = result.current.labs[0]
    const product = result.current.products.find((p) => p.quantityOnHand >= 5)!
    const afterLoan = product.quantityOnHand - 5

    let loan: ReturnType<typeof result.current.createLoan>
    act(() => {
      loan = result.current.createLoan(lab.id, [{ productId: product.id, quantityLoaned: 5 }])
    })
    act(() => {
      result.current.returnLoanLines(loan!.id, [{ lineId: loan!.lines[0].id, quantityReturned: 3, quantityLost: 2, lostReason: 'Dropped and damaged' }])
    })

    const updatedLoan = result.current.loans.find((l) => l.id === loan!.id)!
    expect(updatedLoan.status).toBe('closed')
    expect(updatedLoan.lines[0].quantityReturned).toBe(3)
    expect(updatedLoan.lines[0].quantityLost).toBe(2)

    // Stock is restored for the 3 returned, but NOT for the 2 lost.
    const updatedProduct = result.current.products.find((p) => p.id === product.id)!
    expect(updatedProduct.quantityOnHand).toBe(afterLoan + 3)

    const lostMovement = result.current.movements.find((m) => m.type === 'lost')!
    expect(lostMovement.quantity).toBe(-2)
    expect(lostMovement.reason).toBe('Dropped and damaged')
  })
})

describe('createSale', () => {
  it('computes the total from line items, decreases stock, and records a sale movement', () => {
    const { result } = setup()
    const product = result.current.products.find((p) => p.quantityOnHand >= 2)!
    const before = product.quantityOnHand

    let sale: ReturnType<typeof result.current.createSale>
    act(() => {
      sale = result.current.createSale([{ productId: product.id, quantity: 2, unitPrice: 150 }])
    })

    expect(sale!.total).toBe(300)

    const updatedProduct = result.current.products.find((p) => p.id === product.id)!
    expect(updatedProduct.quantityOnHand).toBe(before - 2)

    const movement = result.current.movements[0]
    expect(movement.type).toBe('sale')
    expect(movement.quantity).toBe(-2)
    expect(movement.reference).toBe(sale!.saleNumber)
  })

  it('labels the movement reason differently for a case-linked sale vs. a direct sale', () => {
    const { result } = setup()
    const product = result.current.products.find((p) => p.quantityOnHand >= 1)!
    const existingCase = result.current.cases[0]

    act(() => {
      result.current.createSale([{ productId: product.id, quantity: 1, unitPrice: 100 }], undefined, existingCase.id)
    })
    expect(result.current.movements[0].reason).toBe('Used in patient case')

    act(() => {
      result.current.createSale([{ productId: product.id, quantity: 1, unitPrice: 100 }])
    })
    expect(result.current.movements[0].reason).toBe('Direct sale')
  })
})

/**
 * These rules used to be enforced only by the calling UI dialogs
 * (ARCHITECTURE.md §6.2). They are now also enforced directly in
 * DataContext's actions, so a violation throws rather than silently
 * mutating state. Each test asserts both that the throw happens AND that
 * no partial state change occurred.
 */
describe('business-rule validation (M4)', () => {
  it('adjustStock rejects an empty or whitespace-only reason and does not mutate stock', () => {
    const { result } = setup()
    const product = result.current.products[0]
    const beforeQty = product.quantityOnHand
    const beforeMovementCount = result.current.movements.length

    expect(() => result.current.adjustStock(product.id, 5, '')).toThrow(/reason is required/i)
    expect(() => result.current.adjustStock(product.id, 5, '   ')).toThrow(/reason is required/i)

    const unchanged = result.current.products.find((p) => p.id === product.id)!
    expect(unchanged.quantityOnHand).toBe(beforeQty)
    expect(result.current.movements.length).toBe(beforeMovementCount)
  })

  it('createLoan rejects a labId that does not reference a real lab', () => {
    const { result } = setup()
    const product = result.current.products[0]
    const before = result.current.loans.length

    expect(() => result.current.createLoan('not-a-real-lab-id', [{ productId: product.id, quantityLoaned: 1 }])).toThrow(/only.*issued to a lab/i)
    expect(result.current.loans.length).toBe(before)
  })

  it('createLoan rejects an empty line list', () => {
    const { result } = setup()
    const lab = result.current.labs[0]

    expect(() => result.current.createLoan(lab.id, [])).toThrow(/at least one product line/i)
  })

  it('receivePurchaseOrder rejects a receipt with no positive quantity on any line', () => {
    const { result } = setup()
    const vendor = result.current.vendors[0]
    const product = result.current.products[0]

    let po: ReturnType<typeof result.current.createPurchaseOrder>
    act(() => {
      po = result.current.createPurchaseOrder(vendor.id, [{ productId: product.id, quantityOrdered: 10, unitCost: 5 }], new Date().toISOString())
    })

    expect(() => result.current.receivePurchaseOrder(po!.id, [{ lineId: po!.lines[0].id, quantityReceived: 0 }])).toThrow(/at least one line/i)
    const unchangedPo = result.current.purchaseOrders.find((p) => p.id === po!.id)!
    expect(unchangedPo.status).toBe('draft')
  })

  it('returnLoanLines rejects an all-zero return', () => {
    const { result } = setup()
    const lab = result.current.labs[0]
    const product = result.current.products.find((p) => p.quantityOnHand >= 1)!

    let loan: ReturnType<typeof result.current.createLoan>
    act(() => {
      loan = result.current.createLoan(lab.id, [{ productId: product.id, quantityLoaned: 1 }])
    })

    expect(() => result.current.returnLoanLines(loan!.id, [{ lineId: loan!.lines[0].id, quantityReturned: 0, quantityLost: 0 }])).toThrow(/at least one item/i)
  })

  it('returnLoanLines rejects a lost quantity with no reason', () => {
    const { result } = setup()
    const lab = result.current.labs[0]
    const product = result.current.products.find((p) => p.quantityOnHand >= 1)!

    let loan: ReturnType<typeof result.current.createLoan>
    act(() => {
      loan = result.current.createLoan(lab.id, [{ productId: product.id, quantityLoaned: 1 }])
    })

    expect(() =>
      result.current.returnLoanLines(loan!.id, [{ lineId: loan!.lines[0].id, quantityReturned: 0, quantityLost: 1 }]),
    ).toThrow(/reason is required/i)
  })

  it('createSale rejects an empty line list', () => {
    const { result } = setup()
    const before = result.current.sales.length
    expect(() => result.current.createSale([])).toThrow(/at least one product line/i)
    expect(result.current.sales.length).toBe(before)
  })
})

/**
 * P1-B: createSale/createLoan must reject an attempt to sell/loan more than
 * quantityOnHand instead of silently letting applyQtyDelta's Math.max(0, ...)
 * floor clamp it to zero (AUDIT.md Executive Summary #2).
 */
describe('Stock-availability enforcement (P1-B)', () => {
  it('createSale rejects a single line that requests more than quantityOnHand, and stock is unchanged', () => {
    const { result } = setup()
    const product = result.current.products.find((p) => p.quantityOnHand > 0)!
    const before = product.quantityOnHand
    const beforeSaleCount = result.current.sales.length
    const beforeMovementCount = result.current.movements.length

    expect(() => result.current.createSale([{ productId: product.id, quantity: before + 1, unitPrice: 100 }])).toThrow(/not enough stock/i)

    expect(result.current.products.find((p) => p.id === product.id)!.quantityOnHand).toBe(before)
    expect(result.current.sales.length).toBe(beforeSaleCount)
    expect(result.current.movements.length).toBe(beforeMovementCount)
  })

  it('createSale rejects when the SAME product appears on multiple lines and their combined quantity exceeds stock', () => {
    const { result } = setup()
    const product = result.current.products.find((p) => p.quantityOnHand >= 4)!
    const before = product.quantityOnHand
    const half = Math.ceil(before / 2)

    // Each line alone is <= before, but together they exceed it.
    expect(() =>
      result.current.createSale([
        { productId: product.id, quantity: half, unitPrice: 100 },
        { productId: product.id, quantity: before - half + 1, unitPrice: 100 },
      ]),
    ).toThrow(/not enough stock/i)

    expect(result.current.products.find((p) => p.id === product.id)!.quantityOnHand).toBe(before)
  })

  it('createSale allows selling exactly the full quantityOnHand', () => {
    const { result } = setup()
    const product = result.current.products.find((p) => p.quantityOnHand > 0)!
    const before = product.quantityOnHand

    act(() => {
      result.current.createSale([{ productId: product.id, quantity: before, unitPrice: 100 }])
    })

    expect(result.current.products.find((p) => p.id === product.id)!.quantityOnHand).toBe(0)
  })

  it('createLoan rejects a single line that requests more than quantityOnHand, and stock is unchanged', () => {
    const { result } = setup()
    const lab = result.current.labs[0]
    const product = result.current.products.find((p) => p.quantityOnHand > 0)!
    const before = product.quantityOnHand
    const beforeLoanCount = result.current.loans.length

    expect(() => result.current.createLoan(lab.id, [{ productId: product.id, quantityLoaned: before + 1 }])).toThrow(/not enough stock/i)

    expect(result.current.products.find((p) => p.id === product.id)!.quantityOnHand).toBe(before)
    expect(result.current.loans.length).toBe(beforeLoanCount)
  })

  it('createLoan rejects when the SAME product appears on multiple lines and their combined quantity exceeds stock', () => {
    const { result } = setup()
    const lab = result.current.labs[0]
    const product = result.current.products.find((p) => p.quantityOnHand >= 4)!
    const before = product.quantityOnHand
    const half = Math.ceil(before / 2)

    expect(() =>
      result.current.createLoan(lab.id, [
        { productId: product.id, quantityLoaned: half },
        { productId: product.id, quantityLoaned: before - half + 1 },
      ]),
    ).toThrow(/not enough stock/i)

    expect(result.current.products.find((p) => p.id === product.id)!.quantityOnHand).toBe(before)
  })
})

/**
 * Phase 3: the production Purchase Order workflow — status gates, the
 * append-only audit history, the timestamp-based ID, and the rule that a
 * Purchase Order never changes inventory itself (only receiving does).
 */
describe('Purchase Order workflow (Phase 3)', () => {
  function createDraftPO(result: { current: ReturnType<typeof useData> }) {
    const vendor = result.current.vendors[0]
    const product = result.current.products[0]
    let po: ReturnType<typeof result.current.createPurchaseOrder>
    act(() => {
      po = result.current.createPurchaseOrder(vendor.id, [{ productId: product.id, quantityOrdered: 10, unitCost: 5 }], new Date().toISOString())
    })
    return po!
  }

  it('creates a draft PO with a timestamp-based ID (YYYYMMDDHHmm) and does not change inventory', () => {
    const { result } = setup()
    const product = result.current.products[0]
    const before = product.quantityOnHand
    const beforeMovementCount = result.current.movements.length

    const po = createDraftPO(result)

    expect(po.poNumber).toMatch(/^\d{12}(-\d+)?$/)
    expect(po.status).toBe('draft')

    const unchangedProduct = result.current.products.find((p) => p.id === product.id)!
    expect(unchangedProduct.quantityOnHand).toBe(before)
    expect(result.current.movements.length).toBe(beforeMovementCount)
  })

  it('seeds a one-entry audit history on creation, and every transition appends to it (never replaces it)', () => {
    const { result } = setup()
    const po = createDraftPO(result)
    expect(po.history).toHaveLength(1)
    expect(po.history[0].label).toBe('Purchase Order Created')

    act(() => {
      result.current.submitPurchaseOrder(po.id)
    })
    let updated = result.current.purchaseOrders.find((p) => p.id === po.id)!
    expect(updated.history).toHaveLength(2)
    expect(updated.history[0].label).toBe('Purchase Order Created') // original entry preserved, not overwritten
    expect(updated.history[1].label).toBe('Submitted to Vendor')

    act(() => {
      result.current.confirmPurchaseOrder(po.id)
    })
    updated = result.current.purchaseOrders.find((p) => p.id === po.id)!
    expect(updated.history).toHaveLength(3)
    expect(updated.history[2].label).toBe('Confirmed by Vendor')
    expect(updated.confirmedAt).toBeTruthy()
  })

  it('confirmPurchaseOrder only allows the submitted -> confirmed transition', () => {
    const { result } = setup()
    const po = createDraftPO(result)

    // Still draft — confirming before submitting is rejected.
    expect(() => result.current.confirmPurchaseOrder(po.id)).toThrow(/only a submitted purchase order/i)

    act(() => {
      result.current.submitPurchaseOrder(po.id)
    })
    act(() => {
      result.current.confirmPurchaseOrder(po.id)
    })
    const confirmed = result.current.purchaseOrders.find((p) => p.id === po.id)!
    expect(confirmed.status).toBe('confirmed')

    // Already confirmed — confirming again is rejected.
    expect(() => result.current.confirmPurchaseOrder(po.id)).toThrow(/only a submitted purchase order/i)
  })

  it('submitPurchaseOrder only allows the draft -> submitted transition', () => {
    const { result } = setup()
    const po = createDraftPO(result)
    act(() => {
      result.current.submitPurchaseOrder(po.id)
    })
    // Already submitted — submitting again is rejected.
    expect(() => result.current.submitPurchaseOrder(po.id)).toThrow(/only a draft purchase order/i)
  })

  it('receivePurchaseOrder rejects a draft PO (must be submitted/confirmed/partially-received first)', () => {
    const { result } = setup()
    const po = createDraftPO(result)
    expect(() => result.current.receivePurchaseOrder(po.id, [{ lineId: po.lines[0].id, quantityReceived: 1 }])).toThrow(/cannot be received in its current status/i)
  })

  it('cancelPurchaseOrder is rejected once a PO has been received, and appends a history entry when it succeeds', () => {
    const { result } = setup()
    const po = createDraftPO(result)
    act(() => {
      result.current.submitPurchaseOrder(po.id)
    })
    act(() => {
      result.current.cancelPurchaseOrder(po.id)
    })
    const cancelled = result.current.purchaseOrders.find((p) => p.id === po.id)!
    expect(cancelled.status).toBe('cancelled')
    expect(cancelled.history.at(-1)!.label).toBe('Purchase Order Cancelled')

    expect(() => result.current.cancelPurchaseOrder(po.id)).toThrow(/no longer be cancelled/i)
  })

  it('a full receipt records a "Stock Fully Received" event; a partial receipt records "Stock Partially Received"', () => {
    const { result } = setup()
    const po = createDraftPO(result)
    act(() => {
      result.current.submitPurchaseOrder(po.id)
    })
    act(() => {
      result.current.receivePurchaseOrder(po.id, [{ lineId: po.lines[0].id, quantityReceived: 4 }])
    })
    let updated = result.current.purchaseOrders.find((p) => p.id === po.id)!
    expect(updated.history.at(-1)!.label).toBe('Stock Partially Received')

    act(() => {
      result.current.receivePurchaseOrder(po.id, [{ lineId: po.lines[0].id, quantityReceived: 6 }])
    })
    updated = result.current.purchaseOrders.find((p) => p.id === po.id)!
    expect(updated.history.at(-1)!.label).toBe('Stock Fully Received')
  })

  it('attachPhotoToOrder sets photoDataUrl and records a history entry, and can clear it again', () => {
    const { result } = setup()
    const po = createDraftPO(result)

    act(() => {
      result.current.attachPhotoToOrder(po.id, 'data:image/png;base64,abc123')
    })
    let updated = result.current.purchaseOrders.find((p) => p.id === po.id)!
    expect(updated.photoDataUrl).toBe('data:image/png;base64,abc123')
    expect(updated.history.at(-1)!.label).toBe('Photo Attached')

    act(() => {
      result.current.attachPhotoToOrder(po.id, undefined)
    })
    updated = result.current.purchaseOrders.find((p) => p.id === po.id)!
    expect(updated.photoDataUrl).toBeUndefined()
    expect(updated.history.at(-1)!.label).toBe('Photo Removed')
  })
})

/**
 * P1-A: Case Lifecycle Completion — status transitions and post-creation
 * implant attachment, both backed by a real, append-only Case.history
 * (replacing the static mock timeline for any case touched through
 * DataContext), mirroring the Purchase Order workflow above.
 */
describe('Case lifecycle (P1-A)', () => {
  function createCase(result: { current: ReturnType<typeof useData> }) {
    const patient = result.current.patients[0]
    let caseRecord: ReturnType<typeof result.current.addCase>
    act(() => {
      caseRecord = result.current.addCase({
        patientId: patient.id,
        doctor: 'Dr. Test',
        status: 'planning',
        procedure: 'Single Tooth Implant',
      })
    })
    return caseRecord!
  }

  it('seeds a one-entry audit history on creation, and every advance appends to it (never replaces it)', () => {
    const { result } = setup()
    const caseRecord = createCase(result)
    expect(caseRecord.history).toHaveLength(1)
    expect(caseRecord.history[0].label).toBe('Case Opened')

    act(() => {
      result.current.advanceCaseStatus(caseRecord.id, 'surgery-scheduled')
    })
    const updated = result.current.cases.find((c) => c.id === caseRecord.id)!
    expect(updated.status).toBe('surgery-scheduled')
    expect(updated.history).toHaveLength(2)
    expect(updated.history[0].label).toBe('Case Opened') // original entry preserved, not overwritten
    expect(updated.history[1].label).toBe('Surgery Scheduled')
  })

  it('advances a case through every documented status one step at a time', () => {
    const { result } = setup()
    const caseRecord = createCase(result)

    const sequence: Array<'surgery-scheduled' | 'in-progress' | 'restoration' | 'completed'> = [
      'surgery-scheduled',
      'in-progress',
      'restoration',
      'completed',
    ]
    for (const status of sequence) {
      act(() => {
        result.current.advanceCaseStatus(caseRecord.id, status)
      })
      const updated = result.current.cases.find((c) => c.id === caseRecord.id)!
      expect(updated.status).toBe(status)
    }
    const finalCase = result.current.cases.find((c) => c.id === caseRecord.id)!
    expect(finalCase.history).toHaveLength(5) // Opened + 4 advances
    expect(finalCase.completedDate).toBeTruthy()
  })

  it('rejects an illegal transition (skipping a status) via the guard function, not just the UI', () => {
    const { result } = setup()
    const caseRecord = createCase(result)

    expect(() => result.current.advanceCaseStatus(caseRecord.id, 'in-progress')).toThrow(/cannot move to that status/i)
    expect(() => result.current.advanceCaseStatus(caseRecord.id, 'completed')).toThrow(/cannot move to that status/i)

    const unchanged = result.current.cases.find((c) => c.id === caseRecord.id)!
    expect(unchanged.status).toBe('planning')
    expect(unchanged.history).toHaveLength(1)
  })

  it('rejects any transition once a case is completed or cancelled', () => {
    const { result } = setup()
    const caseRecord = createCase(result)
    act(() => {
      result.current.advanceCaseStatus(caseRecord.id, 'cancelled')
    })
    expect(() => result.current.advanceCaseStatus(caseRecord.id, 'planning')).toThrow(/cannot move to that status/i)
  })

  it('addImplantToCase appends to implants and records a history entry, capturing a lot number for a batch-tracked product', () => {
    const { result } = setup()
    const caseRecord = createCase(result)
    const batchTracked = result.current.products.find((p) => p.batchTracked)!

    act(() => {
      result.current.addImplantToCase(caseRecord.id, { productId: batchTracked.id, tooth: '36', quantity: 1, batchLot: 'LOT-99999' })
    })

    const updated = result.current.cases.find((c) => c.id === caseRecord.id)!
    expect(updated.implants).toHaveLength(1)
    expect(updated.implants[0]).toMatchObject({ productId: batchTracked.id, tooth: '36', batchLot: 'LOT-99999' })
    expect(updated.history.at(-1)!.label).toBe('Implant Added')
  })

  it('addImplantToCase rejects a missing tooth number or non-positive quantity, without mutating the case', () => {
    const { result } = setup()
    const caseRecord = createCase(result)
    const product = result.current.products[0]

    expect(() => result.current.addImplantToCase(caseRecord.id, { productId: product.id, tooth: '', quantity: 1 })).toThrow(/tooth number is required/i)
    expect(() => result.current.addImplantToCase(caseRecord.id, { productId: product.id, tooth: '36', quantity: 0 })).toThrow(/quantity must be greater than zero/i)

    const unchanged = result.current.cases.find((c) => c.id === caseRecord.id)!
    expect(unchanged.implants).toHaveLength(0)
  })
})
