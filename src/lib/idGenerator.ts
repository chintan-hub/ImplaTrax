/**
 * Internal record IDs and human-readable sequence numbers (PO/loan/sale
 * numbers, patient codes, Case IDs) used to be derived from the live
 * entity array's `.length` at call time (`array.length + 1`). That only
 * produced correct, collision-free numbers because nothing was ever
 * deleted and only one client ever mutated state in a session — see
 * ARCHITECTURE.md §6.3. These counters are independent of array length,
 * so they keep working once deletion (or a real backend) exists.
 */

let internalIdCounter = 100000

export function nextInternalId(prefix: string): string {
  internalIdCounter += 1
  return `${prefix}_${internalIdCounter}`
}

/** A simple monotonic counter, seeded from a starting value, incrementing on every call. */
export function createSequence(start: number) {
  let n = start
  return () => n++
}
