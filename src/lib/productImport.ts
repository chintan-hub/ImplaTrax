import { MANUFACTURERS, PRODUCT_CATEGORIES } from '@/types'
import type { Manufacturer, Product, ProductCategory } from '@/types'

export type ImportableProduct = Omit<Product, 'id' | 'sku' | 'barcode' | 'qrPayload' | 'createdAt' | 'updatedAt'>

export interface ImportRowResult {
  rowNumber: number
  raw: Record<string, string>
  errors: string[]
  warnings: string[]
  product?: ImportableProduct
}

export const IMPORT_TEMPLATE_HEADERS = [
  'Product',
  'Manufacturer',
  'Category',
  'System',
  'Qty On Hand',
  'Reorder Level',
  'Unit Cost',
  'Unit Price',
  'Diameter (mm)',
  'Length (mm)',
  'Platform',
  'Description',
  'Batch Tracked',
] as const

export const IMPORT_TEMPLATE_EXAMPLE_ROW: Record<(typeof IMPORT_TEMPLATE_HEADERS)[number], string> = {
  Product: 'Straumann BLX Implant Ø4.0mm × 10mm',
  Manufacturer: 'Straumann',
  Category: 'Implant Fixture',
  System: 'BLX',
  'Qty On Hand': '20',
  'Reorder Level': '5',
  'Unit Cost': '180',
  'Unit Price': '260',
  'Diameter (mm)': '4.0',
  'Length (mm)': '10',
  Platform: 'RC',
  Description: '',
  'Batch Tracked': 'No',
}

function findCaseInsensitive<T extends string>(list: readonly T[], value: string): T | undefined {
  const v = value.trim().toLowerCase()
  return list.find((item) => item.toLowerCase() === v)
}

function parseNonNegativeNumber(raw: string, field: string, errors: string[]): number | undefined {
  if (raw.trim() === '') {
    errors.push(`${field} is required.`)
    return undefined
  }
  const n = Number(raw)
  if (!Number.isFinite(n) || n < 0) {
    errors.push(`${field} must be a non-negative number (got "${raw}").`)
    return undefined
  }
  return n
}

function parseOptionalNumber(raw: string, field: string, errors: string[]): number | undefined {
  if (raw.trim() === '') return undefined
  const n = Number(raw)
  if (!Number.isFinite(n) || n < 0) {
    errors.push(`${field} must be a non-negative number if provided (got "${raw}").`)
    return undefined
  }
  return n
}

function parseBoolean(raw: string): boolean {
  const v = raw.trim().toLowerCase()
  return v === 'yes' || v === 'true' || v === '1'
}

/**
 * Validates every parsed CSV row against the exact same field rules
 * ProductFormDialog enforces for a single manually-created product — bulk
 * import must not be a looser path than the one-at-a-time UI. Nothing here
 * mutates state; the caller only ever commits the rows with zero `errors`,
 * via DataContext's `importProducts`, after the user has reviewed this
 * preview (never a silent bulk write).
 */
export function validateImportRows(rows: Record<string, string>[], existingProducts: Product[]): ImportRowResult[] {
  const existingNames = new Set(existingProducts.map((p) => p.name.trim().toLowerCase()))
  const namesSeenThisImport = new Set<string>()

  return rows.map((raw, i): ImportRowResult => {
    const errors: string[] = []
    const warnings: string[] = []
    const rowNumber = i + 2 // account for the header row, so this matches the line number a user sees in a spreadsheet

    const name = (raw['Product'] ?? '').trim()
    if (!name) errors.push('Product name is required.')

    const manufacturerRaw = raw['Manufacturer'] ?? ''
    const manufacturer: Manufacturer | undefined = manufacturerRaw.trim()
      ? findCaseInsensitive(MANUFACTURERS, manufacturerRaw)
      : undefined
    if (!manufacturerRaw.trim()) errors.push('Manufacturer is required.')
    else if (!manufacturer) errors.push(`Manufacturer "${manufacturerRaw}" is not recognized. Must be one of: ${MANUFACTURERS.join(', ')}.`)

    const categoryRaw = raw['Category'] ?? ''
    const category: ProductCategory | undefined = categoryRaw.trim()
      ? findCaseInsensitive(PRODUCT_CATEGORIES, categoryRaw)
      : undefined
    if (!categoryRaw.trim()) errors.push('Category is required.')
    else if (!category) errors.push(`Category "${categoryRaw}" is not recognized. Must be one of: ${PRODUCT_CATEGORIES.join(', ')}.`)

    const system = (raw['System'] ?? '').trim()
    if (!system) errors.push('System is required.')

    const quantityOnHand = parseNonNegativeNumber(raw['Qty On Hand'] ?? '', 'Qty On Hand', errors)
    const lowStockThreshold = parseNonNegativeNumber(raw['Reorder Level'] ?? '', 'Reorder Level', errors)
    const unitCost = parseNonNegativeNumber(raw['Unit Cost'] ?? '', 'Unit Cost', errors)
    const unitPrice = parseNonNegativeNumber(raw['Unit Price'] ?? '', 'Unit Price', errors)
    const diameterMm = parseOptionalNumber(raw['Diameter (mm)'] ?? '', 'Diameter (mm)', errors)
    const lengthMm = parseOptionalNumber(raw['Length (mm)'] ?? '', 'Length (mm)', errors)

    if (name) {
      const key = name.toLowerCase()
      if (existingNames.has(key)) warnings.push(`A product named "${name}" already exists — this will be created as a separate product, not merged with it.`)
      if (namesSeenThisImport.has(key)) warnings.push(`"${name}" appears more than once in this file.`)
      namesSeenThisImport.add(key)
    }

    if (errors.length > 0 || !manufacturer || !category || quantityOnHand === undefined || lowStockThreshold === undefined || unitCost === undefined || unitPrice === undefined) {
      return { rowNumber, raw, errors, warnings }
    }

    const product: ImportableProduct = {
      name,
      manufacturer,
      category,
      system,
      diameterMm,
      lengthMm,
      platform: (raw['Platform'] ?? '').trim() || undefined,
      unitCost,
      unitPrice,
      priceVisible: true,
      quantityOnHand,
      quantityReserved: 0,
      lowStockThreshold,
      batchTracked: parseBoolean(raw['Batch Tracked'] ?? ''),
      vendorId: '', // resolved by DataContext.importProducts, same auto-match-by-manufacturer rule as manual product creation
      imageColor: '#12a2a3',
      description: (raw['Description'] ?? '').trim(),
      status: 'active',
    }

    return { rowNumber, raw, errors, warnings, product }
  })
}
