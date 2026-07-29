import type { Product } from '@/types'

/**
 * Single source of truth for stock status/availability — both are computed
 * purely from fields the data model already has (quantityOnHand,
 * quantityReserved, lowStockThreshold), never invented (P1-N, locked
 * 2026-07-29). Reserved Stock itself stays a placeholder — nothing writes to
 * it yet (see PROJECT.md §3) — this only reads it, it doesn't fix that gap.
 */
export type StockStatus = 'normal' | 'low' | 'out'

export const STOCK_STATUS_LABEL: Record<StockStatus, string> = {
  normal: 'Normal',
  low: 'Low Stock',
  out: 'Out of Stock',
}

export function stockStatus(product: Pick<Product, 'quantityOnHand' | 'lowStockThreshold'>): StockStatus {
  if (product.quantityOnHand <= 0) return 'out'
  if (product.quantityOnHand <= product.lowStockThreshold) return 'low'
  return 'normal'
}

export function availableStock(product: Pick<Product, 'quantityOnHand' | 'quantityReserved'>): number {
  return Math.max(0, product.quantityOnHand - product.quantityReserved)
}
