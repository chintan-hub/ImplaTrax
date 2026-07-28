import type { Case, CaseStatus } from '@/types'

/**
 * Single source of truth for which Case status transitions are legal. Used
 * both by DataContext (to enforce the rule) and by the UI (to decide which
 * action buttons to show) — mirrors src/lib/poWorkflow.ts.
 *
 * Lifecycle: planning -> surgery-scheduled -> in-progress -> restoration -> completed
 * No status may be skipped. Cancellation is allowed from any non-terminal
 * status (not from completed or cancelled) — see PROJECT.md §3.
 */
const CASE_STATUS_SEQUENCE: CaseStatus[] = ['planning', 'surgery-scheduled', 'in-progress', 'restoration', 'completed']

/** The statuses a case can legally move to next from its current status. */
export function nextCaseStatuses(current: CaseStatus): CaseStatus[] {
  if (current === 'completed' || current === 'cancelled') return []
  const idx = CASE_STATUS_SEQUENCE.indexOf(current)
  const forward = idx >= 0 && idx < CASE_STATUS_SEQUENCE.length - 1 ? [CASE_STATUS_SEQUENCE[idx + 1]] : []
  return [...forward, 'cancelled']
}

export function canAdvanceCaseStatus(caseRecord: Pick<Case, 'status'>, target: CaseStatus): boolean {
  return nextCaseStatuses(caseRecord.status).includes(target)
}
