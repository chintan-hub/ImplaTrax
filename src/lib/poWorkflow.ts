import type { POStatus, PurchaseOrder } from '@/types'

/**
 * Single source of truth for which Purchase Order status transitions are
 * legal. Used both by DataContext (to enforce the rule server-side-shaped,
 * see ARCHITECTURE.md §6.2/§8.2) and by the UI (to decide which action
 * buttons to show) — one place, not two copies that can drift apart.
 *
 * Lifecycle: draft -> submitted -> confirmed -> partially-received -> received
 * Cancellation is allowed from draft/submitted/confirmed (before any receipt).
 * A Purchase Order never changes inventory itself — only receiving does.
 */
export function canSubmitPO(po: Pick<PurchaseOrder, 'status'>): boolean {
  return po.status === 'draft'
}

export function canReceivePO(po: Pick<PurchaseOrder, 'status'>): boolean {
  return (['submitted', 'confirmed', 'partially-received'] as POStatus[]).includes(po.status)
}

export function canCancelPO(po: Pick<PurchaseOrder, 'status'>): boolean {
  return (['draft', 'submitted', 'confirmed'] as POStatus[]).includes(po.status)
}
