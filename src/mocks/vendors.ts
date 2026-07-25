import type { Vendor, Manufacturer } from '@/types'
import { VENDOR_NAMES, FIRST_NAMES, LAST_NAMES } from './names'
import { pick, ri, iso, daysAgo } from './rng'

const MANUFACTURER_MAP: Manufacturer[][] = [
  ['Straumann'],
  ['Nobel Biocare'],
  ['Osstem'],
  ['NeoBiotech'],
  ['Dentium'],
  ['MIS'],
  ['Straumann', 'Nobel Biocare', 'Osstem'],
  ['NeoBiotech', 'Dentium', 'MIS'],
]

const COUNTRIES = ['United States', 'Switzerland', 'South Korea', 'Germany', 'Sweden']

export const vendors: Vendor[] = VENDOR_NAMES.map((name, i) => ({
  id: `vnd_${i + 1}`,
  name,
  contactName: `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}`,
  email: `sales@${name.toLowerCase().replace(/[^a-z]+/g, '')}.com`,
  phone: `+1 (${ri(200, 989)}) ${ri(200, 989)}-${ri(1000, 9999)}`,
  address: `${ri(100, 9999)} Industrial Pkwy, Suite ${ri(100, 400)}`,
  country: pick(COUNTRIES),
  manufacturers: MANUFACTURER_MAP[i],
  onTimeRate: Math.round((0.82 + ri(0, 16) / 100) * 100) / 100,
  totalOrders: ri(12, 220),
  createdAt: iso(daysAgo(ri(400, 1200))),
}))

export function vendorForManufacturer(m: Manufacturer): string {
  const match = vendors.find((v) => v.manufacturers.includes(m) && v.manufacturers.length === 1)
  return match?.id ?? vendors[0].id
}
