// Deterministic PRNG (mulberry32) so mock data is stable across reloads/HMR.
export function mulberry32(seed: number) {
  let a = seed
  return function () {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const rand = mulberry32(20260101)

export function rf() {
  return rand()
}

export function ri(min: number, max: number) {
  return Math.floor(rand() * (max - min + 1)) + min
}

export function pick<T>(arr: readonly T[]): T {
  return arr[ri(0, arr.length - 1)]
}

export function pickMany<T>(arr: readonly T[], count: number): T[] {
  const pool = [...arr]
  const out: T[] = []
  for (let i = 0; i < count && pool.length; i++) {
    const idx = ri(0, pool.length - 1)
    out.push(pool[idx])
    pool.splice(idx, 1)
  }
  return out
}

export function chance(p: number) {
  return rand() < p
}

export function pad(n: number, width: number) {
  return String(n).padStart(width, '0')
}

export function daysAgo(days: number) {
  const d = new Date()
  d.setDate(d.getDate() - days)
  return d
}

export function daysFromNow(days: number) {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return d
}

export function iso(d: Date) {
  return d.toISOString()
}

export function randomDateBetween(daysAgoMax: number, daysAgoMin = 0) {
  return iso(daysAgo(ri(daysAgoMin, daysAgoMax)))
}
