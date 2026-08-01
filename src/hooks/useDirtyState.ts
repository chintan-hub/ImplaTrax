import { useMemo } from 'react'

/**
 * Generic "has this form changed from what's saved" check for any settings
 * form — text inputs, switches, dropdowns, checkboxes, number fields, color
 * pickers, date inputs all end up as plain string/number/boolean fields on
 * the form's state object regardless of which control produced them, so a
 * structural comparison against the last-saved value covers every control
 * type uniformly with no per-field wiring. Reverting every field back to
 * its saved value naturally makes this false again — there's no separate
 * "dirty" flag to remember to reset.
 */
export function useDirtyState<T>(saved: T, current: T): boolean {
  return useMemo(() => JSON.stringify(current) !== JSON.stringify(saved), [saved, current])
}
