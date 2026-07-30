/**
 * Blob-based CSV export — no external dependency. Callers pre-shape `rows`
 * with the final column-header names as keys; the header row is derived
 * from the first row's keys.
 */
export function exportToCsv(rows: Record<string, unknown>[], filename: string): void {
  if (rows.length === 0) return

  const headers = Object.keys(rows[0])

  const escape = (value: unknown): string => {
    const str = value === null || value === undefined ? '' : String(value)
    return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str
  }

  const lines = [
    headers.map(escape).join(','),
    ...rows.map((row) => headers.map((key) => escape(row[key])).join(',')),
  ]

  const blob = new Blob([lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

/**
 * The inverse of exportToCsv's escaping — a small RFC4180-style parser
 * (quoted fields, embedded commas/quotes/newlines, "" as an escaped quote)
 * rather than a naive split(','), so a file this app exported round-trips
 * cleanly back through this parser. Returns one object per data row, keyed
 * by the header row's column names; blank trailing rows are skipped.
 */
export function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let inQuotes = false
  let i = 0

  while (i < text.length) {
    const char = text[i]
    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"'
          i += 2
        } else {
          inQuotes = false
          i += 1
        }
      } else {
        field += char
        i += 1
      }
      continue
    }
    if (char === '"') {
      inQuotes = true
      i += 1
    } else if (char === ',') {
      row.push(field)
      field = ''
      i += 1
    } else if (char === '\r') {
      i += 1
    } else if (char === '\n') {
      row.push(field)
      rows.push(row)
      row = []
      field = ''
      i += 1
    } else {
      field += char
      i += 1
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field)
    rows.push(row)
  }

  if (rows.length === 0) return []
  const headers = rows[0].map((h) => h.trim())
  return rows
    .slice(1)
    .filter((r) => r.some((cell) => cell.trim() !== ''))
    .map((r) => Object.fromEntries(headers.map((h, idx) => [h, (r[idx] ?? '').trim()])))
}
