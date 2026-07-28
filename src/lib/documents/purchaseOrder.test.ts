import { describe, it, expect } from 'vitest'
import { buildPurchaseOrderDocumentData } from './purchaseOrder'
import type { Product, PurchaseOrder, Vendor } from '@/types'

function makeProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: 'prod-1',
    sku: 'SKU-001',
    name: 'Test Fixture',
    manufacturer: 'Straumann',
    category: 'Implant Fixture',
    system: 'BLX',
    barcode: '000001',
    qrPayload: 'IMPD:PRD:prod-1',
    unitCost: 100,
    unitPrice: 150,
    priceVisible: true,
    quantityOnHand: 10,
    quantityReserved: 0,
    lowStockThreshold: 2,
    batchTracked: false,
    vendorId: 'vendor-1',
    imageColor: '#2563eb',
    description: 'Test fixture used for document data-shaping tests.',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    status: 'active',
    ...overrides,
  }
}

function makeVendor(overrides: Partial<Vendor> = {}): Vendor {
  return {
    id: 'vendor-1',
    name: 'Acme Dental Supply',
    contactName: 'Jordan Lee',
    email: 'jordan@acmedental.example',
    phone: '555-0100',
    address: '1 Supply Way',
    country: 'USA',
    manufacturers: ['Straumann'],
    onTimeRate: 0.9,
    totalOrders: 12,
    createdAt: '2025-01-01T00:00:00.000Z',
    ...overrides,
  }
}

function makePO(overrides: Partial<PurchaseOrder> = {}): PurchaseOrder {
  return {
    id: 'po-1',
    poNumber: 'PO-2026-00001',
    vendorId: 'vendor-1',
    status: 'partially-received',
    createdAt: '2026-07-01T00:00:00.000Z',
    eta: '2026-07-15T00:00:00.000Z',
    lines: [{ id: 'line-1', productId: 'prod-1', quantityOrdered: 5, quantityReceived: 2, unitCost: 100 }],
    history: [],
    ...overrides,
  }
}

describe('buildPurchaseOrderDocumentData', () => {
  it('shapes vendor, product, and totals from the source records', () => {
    const product = makeProduct()
    const vendor = makeVendor()
    const po = makePO()
    const data = buildPurchaseOrderDocumentData(po, vendor, new Map([[product.id, product]]))

    expect(data.poNumber).toBe('PO-2026-00001')
    expect(data.vendorName).toBe('Acme Dental Supply')
    expect(data.status).toBe('Partially Received')
    expect(data.lines).toEqual([
      { productName: 'Test Fixture', sku: 'SKU-001', quantityOrdered: 5, unitCost: 100, lineTotal: 500 },
    ])
    expect(data.total).toBe(500)
  })

  it('falls back to placeholder text for a missing vendor or product', () => {
    const po = makePO()
    const data = buildPurchaseOrderDocumentData(po, undefined, new Map())

    expect(data.vendorName).toBe('Unknown vendor')
    expect(data.vendorContact).toBe('—')
    expect(data.lines[0].productName).toBe('Unknown product')
    expect(data.lines[0].sku).toBe('—')
  })

  it('sums line totals across multiple lines', () => {
    const productA = makeProduct({ id: 'prod-a', sku: 'SKU-A', name: 'Fixture A' })
    const productB = makeProduct({ id: 'prod-b', sku: 'SKU-B', name: 'Fixture B' })
    const po = makePO({
      lines: [
        { id: 'line-1', productId: 'prod-a', quantityOrdered: 2, quantityReceived: 0, unitCost: 50 },
        { id: 'line-2', productId: 'prod-b', quantityOrdered: 3, quantityReceived: 0, unitCost: 20 },
      ],
    })
    const data = buildPurchaseOrderDocumentData(
      po,
      makeVendor(),
      new Map([
        [productA.id, productA],
        [productB.id, productB],
      ]),
    )

    expect(data.total).toBe(2 * 50 + 3 * 20)
  })
})
