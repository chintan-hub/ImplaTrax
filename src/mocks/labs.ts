import type { Lab } from '@/types'
import { LAB_NAME_PARTS_A, LAB_NAME_PARTS_B, LAB_SPECIALTIES, FIRST_NAMES, LAST_NAMES } from './names'
import { ri, pick, pickMany, iso, daysAgo } from './rng'

const usedNames = new Set<string>()
function uniqueLabName() {
  let name = ''
  do {
    name = `${pick(LAB_NAME_PARTS_A)} ${pick(LAB_NAME_PARTS_B)}`
  } while (usedNames.has(name))
  usedNames.add(name)
  return name
}

export const labs: Lab[] = Array.from({ length: 25 }).map((_, i) => ({
  id: `lab_${i + 1}`,
  name: uniqueLabName(),
  contactName: `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}`,
  email: `orders@lab${i + 1}.dental`,
  phone: `+1 (${ri(200, 989)}) ${ri(200, 989)}-${ri(1000, 9999)}`,
  address: `${ri(100, 9999)} ${pick(['Main St', 'Commerce Ave', 'Industrial Blvd', 'Technology Dr', 'Park Rd'])}, Suite ${ri(1, 40)}0`,
  specialties: pickMany(LAB_SPECIALTIES, ri(1, 3)),
  rating: Math.round((3.4 + ri(0, 16) / 10) * 10) / 10,
  turnaroundDays: ri(5, 21),
  createdAt: iso(daysAgo(ri(60, 1100))),
}))
