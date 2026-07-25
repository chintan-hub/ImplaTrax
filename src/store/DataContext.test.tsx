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
