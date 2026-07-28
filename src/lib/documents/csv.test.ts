import { describe, it, expect, afterEach, vi } from 'vitest'
import { exportToCsv } from './csv'

describe('exportToCsv', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  function captureDownload() {
    const clicks: HTMLAnchorElement[] = []
    const originalCreateElement = document.createElement.bind(document)
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      const el = originalCreateElement(tag)
      if (tag === 'a') {
        vi.spyOn(el as HTMLAnchorElement, 'click').mockImplementation(() => {
          clicks.push(el as HTMLAnchorElement)
        })
      }
      return el
    })
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock-url')
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
    return clicks
  }

  it('does nothing for an empty dataset', () => {
    const clicks = captureDownload()
    exportToCsv([], 'empty.csv')
    expect(clicks).toHaveLength(0)
  })

  it('derives headers from the first row and downloads the file with the given name', () => {
    const clicks = captureDownload()
    exportToCsv([{ Product: 'Widget', Quantity: 5 }], 'movements.csv')
    expect(clicks).toHaveLength(1)
    expect(clicks[0].download).toBe('movements.csv')
  })

  it('escapes commas, quotes, and newlines in values', async () => {
    let capturedBlob: Blob | undefined
    vi.spyOn(URL, 'createObjectURL').mockImplementation((blob) => {
      capturedBlob = blob as Blob
      return 'blob:mock-url'
    })
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
    const originalCreateElement = document.createElement.bind(document)
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      const el = originalCreateElement(tag)
      if (tag === 'a') vi.spyOn(el as HTMLAnchorElement, 'click').mockImplementation(() => {})
      return el
    })

    exportToCsv([{ Reason: 'Damaged, "wet" box\nreturned' }], 'reasons.csv')

    const text = await capturedBlob!.text()
    expect(text).toBe('Reason\r\n"Damaged, ""wet"" box\nreturned"')
  })
})
