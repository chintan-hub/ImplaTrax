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

/** Persistence support: read/restore the counter's raw value across a reload so a fresh session's IDs never collide with previously-persisted ones. */
export function getInternalIdCounter(): number {
  return internalIdCounter
}

export function restoreInternalIdCounter(value: number) {
  internalIdCounter = value
}

/** A simple monotonic counter, seeded from a starting value, incrementing on every call. */
export function createSequence(start: number) {
  let n = start
  return () => n++
}

function pad2(n: number) {
  return String(n).padStart(2, '0')
}

/** Formats a Date as YYYYMMDDHHmm (e.g. 202607271432) — the required format for Purchase Order IDs. */
export function formatTimestampId(date: Date): string {
  return (
    String(date.getFullYear()) +
    pad2(date.getMonth() + 1) +
    pad2(date.getDate()) +
    pad2(date.getHours()) +
    pad2(date.getMinutes())
  )
}

/**
 * A timestamp-based ID generator (YYYYMMDDHHmm). Two records created in the
 * same calendar minute would otherwise collide, since the format has no
 * seconds — each call after the first for a given minute gets a `-2`, `-3`,
 * ... suffix appended, so IDs stay unique without changing the format in the
 * (overwhelmingly common) case where no collision occurs.
 */
export function createTimestampIdGenerator() {
  const seen = new Map<string, number>()
  return (date: Date = new Date()) => {
    const base = formatTimestampId(date)
    const count = (seen.get(base) ?? 0) + 1
    seen.set(base, count)
    return count === 1 ? base : `${base}-${count}`
  }
}
