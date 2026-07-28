import { describe, it, expect } from 'vitest'
import { nextCaseStatuses, canAdvanceCaseStatus } from './caseWorkflow'
import type { CaseStatus } from '@/types'

describe('caseWorkflow', () => {
  it('walks the full forward lifecycle one step at a time, offering cancel at each non-terminal step', () => {
    const forward: CaseStatus[] = ['planning', 'surgery-scheduled', 'in-progress', 'restoration', 'completed']
    for (let i = 0; i < forward.length - 1; i++) {
      const options = nextCaseStatuses(forward[i])
      expect(options).toContain(forward[i + 1])
      expect(options).toContain('cancelled')
    }
  })

  it('offers no transitions at all from a terminal status (completed or cancelled)', () => {
    expect(nextCaseStatuses('completed')).toEqual([])
    expect(nextCaseStatuses('cancelled')).toEqual([])
  })

  it('rejects skipping a status in the forward sequence', () => {
    expect(canAdvanceCaseStatus({ status: 'planning' }, 'in-progress')).toBe(false)
    expect(canAdvanceCaseStatus({ status: 'planning' }, 'completed')).toBe(false)
  })

  it('rejects moving backward', () => {
    expect(canAdvanceCaseStatus({ status: 'restoration' }, 'in-progress')).toBe(false)
    expect(canAdvanceCaseStatus({ status: 'completed' }, 'planning')).toBe(false)
  })

  it('allows cancellation from any non-terminal status but not from a terminal one', () => {
    expect(canAdvanceCaseStatus({ status: 'planning' }, 'cancelled')).toBe(true)
    expect(canAdvanceCaseStatus({ status: 'restoration' }, 'cancelled')).toBe(true)
    expect(canAdvanceCaseStatus({ status: 'completed' }, 'cancelled')).toBe(false)
    expect(canAdvanceCaseStatus({ status: 'cancelled' }, 'cancelled')).toBe(false)
  })
})
