import type { Product, Manufacturer, ProductCategory } from '@/types'
import { ri, pick, chance, iso, daysAgo } from './rng'
import { vendorForManufacturer } from './vendors'

interface SystemDef {
  manufacturer: Manufacturer
  system: string
  platforms: string[]
  diameters: number[]
  lengths: number[]
}

const SYSTEMS: SystemDef[] = [
  { manufacturer: 'Straumann', system: 'BLX', platforms: ['NC', 'RC'], diameters: [3.5, 3.75, 4.0, 4.5, 5.0], lengths: [6, 8, 10, 12, 14] },
  { manufacturer: 'Straumann', system: 'BLT', platforms: ['NC', 'RC', 'WP'], diameters: [3.3, 4.1, 4.8], lengths: [8, 10, 12, 14] },
  { manufacturer: 'Straumann', system: 'TLX', platforms: ['TL'], diameters: [3.75, 4.0, 4.5], lengths: [8, 10, 12] },
  { manufacturer: 'Nobel Biocare', system: 'NobelActive', platforms: ['NP', 'RP', 'WP'], diameters: [3.5, 4.3, 5.0, 5.5], lengths: [7, 10, 11.5, 13, 15] },
  { manufacturer: 'Nobel Biocare', system: 'NobelParallel CC', platforms: ['NP', 'RP', 'WP'], diameters: [3.75, 4.3, 5.0], lengths: [8, 10, 13, 16] },
  { manufacturer: 'Nobel Biocare', system: 'NobelReplace CC', platforms: ['NP', 'RP'], diameters: [3.5, 4.3, 5.0], lengths: [7, 10, 13] },
  { manufacturer: 'Osstem', system: 'TS III', platforms: ['Mini', 'Regular', 'Wide'], diameters: [3.5, 4.0, 4.5, 5.0], lengths: [7, 8.5, 10, 11.5, 13] },
  { manufacturer: 'Osstem', system: 'TS III SA', platforms: ['Regular', 'Wide'], diameters: [4.0, 4.5, 5.0], lengths: [10, 11.5, 13] },
  { manufacturer: 'Osstem', system: 'US II', platforms: ['Regular'], diameters: [3.5, 4.0, 4.5], lengths: [8.5, 10, 11.5] },
  { manufacturer: 'NeoBiotech', system: 'IS-III', platforms: ['Regular', 'Wide'], diameters: [3.6, 4.0, 4.5, 5.0], lengths: [8.5, 10, 11.5, 13] },
  { manufacturer: 'NeoBiotech', system: 'IS-III Active', platforms: ['Regular'], diameters: [3.6, 4.0, 4.5], lengths: [10, 11.5, 13] },
  { manufacturer: 'Dentium', system: 'Superline', platforms: ['Regular', 'Wide'], diameters: [3.6, 4.0, 4.5, 5.0], lengths: [8.5, 10, 11.5, 13] },
  { manufacturer: 'Dentium', system: 'SuperlineTA', platforms: ['Regular'], diameters: [4.0, 4.5], lengths: [10, 11.5, 13] },
  { manufacturer: 'MIS', system: 'SEVEN', platforms: ['Standard', 'Wide'], diameters: [3.75, 4.2, 5.0], lengths: [8, 10, 13, 16] },
  { manufacturer: 'MIS', system: 'V3', platforms: ['Narrow', 'Regular', 'Wide'], diameters: [3.3, 3.75, 4.2, 5.0], lengths: [8, 10, 11.5, 13] },
  { manufacturer: 'MIS', system: 'C1', platforms: ['Regular'], diameters: [3.75, 4.2], lengths: [10, 11.5, 13] },
]

const ACCENTS = ['#3b82f6', '#14b8a6', '#8b5cf6', '#0ea5e9', '#f59e0b', '#22c55e', '#ec4899', '#6366f1']

function code(str: string) {
  return str.replace(/[^A-Z0-9]/gi, '').toUpperCase()
}

function makeBarcode(index: number) {
  // EAN-13-like numeric barcode, deterministic
  const base = `890${String(1000000 + index).slice(-9)}`
  return base
}

function makeSku(manufacturer: Manufacturer, system: string, category: ProductCategory, diameter: number | undefined, length: number | undefined, index: number) {
  const mCode = code(manufacturer).slice(0, 3)
  const sCode = code(system).slice(0, 4)
  const catCode = code(category).slice(0, 3)
  const dim = diameter && length ? `${diameter.toString().replace('.', '')}X${length.toString().replace('.', '')}` : ''
  return [mCode, sCode, catCode, dim, String(index).padStart(3, '0')].filter(Boolean).join('-')
}

const CATEGORY_WEIGHTS: { category: ProductCategory; weight: number; needsDims: boolean }[] = [
  { category: 'Implant Fixture', weight: 34, needsDims: true },
  { category: 'Healing Abutment', weight: 12, needsDims: false },
  { category: 'Final Abutment', weight: 12, needsDims: false },
  { category: 'Cover Screw', weight: 6, needsDims: false },
  { category: 'Impression Coping', weight: 8, needsDims: false },
  { category: 'Analog', weight: 6, needsDims: false },
  { category: 'Surgical Kit', weight: 4, needsDims: false },
  { category: 'Bone Graft Material', weight: 8, needsDims: false },
  { category: 'Membrane', weight: 5, needsDims: false },
  { category: 'Prosthetic Screw', weight: 5, needsDims: false },
]

function weightedCategory(): { category: ProductCategory; needsDims: boolean } {
  const total = CATEGORY_WEIGHTS.reduce((s, c) => s + c.weight, 0)
  let r = ri(1, total)
  for (const c of CATEGORY_WEIGHTS) {
    r -= c.weight
    if (r <= 0) return c
  }
  return CATEGORY_WEIGHTS[0]
}

function nameFor(category: ProductCategory, manufacturer: Manufacturer, system: string, diameter?: number, length?: number, platform?: string) {
  switch (category) {
    case 'Implant Fixture':
      return `${manufacturer} ${system} Implant Ø${diameter}mm × ${length}mm${platform ? ` (${platform})` : ''}`
    case 'Healing Abutment':
      return `${system} Healing Abutment ${platform ?? ''} ${pick([3, 4, 5, 6])}mm H`.replace(/\s+/g, ' ').trim()
    case 'Final Abutment':
      return `${system} Contoured Abutment ${platform ?? ''}`.replace(/\s+/g, ' ').trim()
    case 'Cover Screw':
      return `${system} Cover Screw ${platform ?? ''}`.replace(/\s+/g, ' ').trim()
    case 'Impression Coping':
      return `${system} Impression Coping — ${pick(['Open Tray', 'Closed Tray'])} ${platform ?? ''}`.replace(/\s+/g, ' ').trim()
    case 'Analog':
      return `${system} Implant Analog ${platform ?? ''}`.replace(/\s+/g, ' ').trim()
    case 'Surgical Kit':
      return `${system} Surgical Drill Kit — Full Sequence`
    case 'Bone Graft Material':
      return `${pick(['MinerOss', 'CopiOs', 'BioOss-Compatible', 'Puros-Compatible'])} Bone Graft ${pick(['0.25cc', '0.5cc', '1.0cc', '2.0cc'])}`
    case 'Membrane':
      return `${pick(['CopiOs', 'BioGide-Compatible', 'CollaGuard'])} Resorbable Membrane ${pick(['15×20mm', '20×30mm', '25×30mm'])}`
    case 'Prosthetic Screw':
      return `${system} Prosthetic Screw ${platform ?? ''}`.replace(/\s+/g, ' ').trim()
    default:
      return `${system} Component`
  }
}

function descriptionFor(category: ProductCategory, manufacturer: Manufacturer) {
  const base: Record<ProductCategory, string> = {
    'Implant Fixture': `Titanium root-form dental implant fixture by ${manufacturer}, engineered for primary stability across a range of bone densities.`,
    'Healing Abutment': `Transmucosal healing abutment used to shape peri-implant soft tissue during osseointegration.`,
    'Final Abutment': `Prosthetic abutment for definitive crown or bridge restoration, compatible with the matching implant platform.`,
    'Cover Screw': `Submergible cover screw used to protect the implant interface during a two-stage healing protocol.`,
    'Impression Coping': `Transfer coping used to capture implant position and orientation during final impression taking.`,
    'Analog': `Laboratory analog replicating the implant platform for master cast fabrication.`,
    'Surgical Kit': `Complete drill sequence and surgical instrumentation kit for guided or freehand implant placement.`,
    'Bone Graft Material': `Particulate bone graft substitute for ridge preservation and guided bone regeneration procedures.`,
    'Membrane': `Resorbable barrier membrane used in guided bone and tissue regeneration procedures.`,
    'Prosthetic Screw': `Retaining screw for securing prosthetic components to the implant or abutment.`,
  }
  return base[category]
}

export const products: Product[] = Array.from({ length: 100 }).map((_, i) => {
  const sys = pick(SYSTEMS)
  const { category, needsDims } = weightedCategory()
  const diameter = needsDims ? pick(sys.diameters) : chance(0.3) ? pick(sys.diameters) : undefined
  const length = needsDims ? pick(sys.lengths) : undefined
  const platform = pick(sys.platforms)
  const name = nameFor(category, sys.manufacturer, sys.system, diameter, length, platform)
  const unitCost = category === 'Implant Fixture' ? ri(95, 260) : category === 'Surgical Kit' ? ri(450, 1200) : category === 'Bone Graft Material' || category === 'Membrane' ? ri(60, 220) : ri(15, 90)
  const margin = 1.4 + ri(0, 40) / 100
  const qty = category === 'Surgical Kit' ? ri(1, 6) : ri(0, 140)
  const low = category === 'Surgical Kit' ? 1 : category === 'Implant Fixture' ? ri(8, 20) : ri(5, 15)

  const product: Product = {
    id: `prd_${i + 1}`,
    sku: makeSku(sys.manufacturer, sys.system, category, diameter, length, i + 1),
    name,
    manufacturer: sys.manufacturer,
    category,
    system: sys.system,
    diameterMm: diameter,
    lengthMm: length,
    platform,
    barcode: makeBarcode(i + 1),
    qrPayload: `IMPD:PRD:${i + 1}`,
    unitCost,
    unitPrice: Math.round(unitCost * margin),
    priceVisible: chance(0.85),
    quantityOnHand: qty,
    quantityReserved: chance(0.3) ? ri(0, Math.min(6, qty)) : 0,
    lowStockThreshold: low,
    batchTracked: category === 'Implant Fixture' || category === 'Bone Graft Material' || category === 'Membrane' ? chance(0.75) : chance(0.15),
    vendorId: vendorForManufacturer(sys.manufacturer),
    imageColor: pick(ACCENTS),
    description: descriptionFor(category, sys.manufacturer),
    createdAt: iso(daysAgo(ri(30, 900))),
    updatedAt: iso(daysAgo(ri(0, 29))),
    status: chance(0.05) ? 'discontinued' : 'active',
  }
  return product
})

// Seed-generation-time helper only (used by other mocks/* generators, e.g.
// sales.ts, to cross-reference the static seed set while building fixtures).
// Do not import this into pages/components — it will not see products
// created at runtime. Look up live products via useData() instead.
export function productById(id: string) {
  return products.find((p) => p.id === id)
}
