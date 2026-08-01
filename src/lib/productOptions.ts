import type { ComboboxOption } from '@/components/ui/combobox'
import type { Product } from '@/types'

/**
 * Shared product → Combobox-option mapping used everywhere a user picks a
 * product from the catalog (Purchase Orders, Sales, Loans, Manual
 * Adjustment, Case implant usage). Search matches name, SKU, manufacturer,
 * system, category, platform, and diameter/length together — typing "4.5",
 * "TS III", "cover screw", or "regular" all find the right component, which
 * a plain name-only dropdown can't do across a large implant catalog.
 */
export function productSearchValue(p: Product): string {
  return [
    p.name,
    p.sku,
    p.manufacturer,
    p.system,
    p.category,
    p.platform,
    p.diameterMm != null ? `${p.diameterMm}mm` : undefined,
    p.diameterMm != null ? String(p.diameterMm) : undefined,
    p.lengthMm != null ? `${p.lengthMm}mm` : undefined,
    p.lengthMm != null ? String(p.lengthMm) : undefined,
  ]
    .filter(Boolean)
    .join(' ')
}

export function productComboboxOptions(products: Product[], labelFor?: (p: Product) => string): ComboboxOption[] {
  return products.map((p) => ({
    value: p.id,
    label: labelFor ? labelFor(p) : p.name,
    searchValue: productSearchValue(p),
  }))
}
