import type { Doctor } from '@/types'
import { DOCTORS } from './names'
import { iso, daysAgo, ri } from './rng'

export const doctors: Doctor[] = DOCTORS.map((d, i) => ({
  id: `doc_${i + 1}`,
  name: d.replace(/^Dr\.\s*/, ''),
  createdAt: iso(daysAgo(ri(200, 1400))),
  active: true,
}))
