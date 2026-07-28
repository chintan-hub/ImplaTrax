import type { Loan } from '@/types'

/**
 * Single source of truth for whether a Loan can still be returned against.
 * Used both by DataContext (to enforce the rule) and by the UI (to decide
 * whether to show the "Process Return" action) — mirrors poWorkflow.ts.
 *
 * Lifecycle: open -> partially-returned -> closed (via one or more returns).
 * Loans have no cancelled state, so this is the only transition to guard.
 */
export function canReturnLoan(loan: Pick<Loan, 'status'>): boolean {
  return loan.status !== 'closed'
}
