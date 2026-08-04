import { useEffect, useState } from 'react'
import { usePDF } from '@react-pdf/renderer'
import { FileDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ManualDocument } from '@/lib/documents/manual'
import type { ButtonProps } from '@/components/ui/button'

/**
 * Generates the User Manual PDF entirely client-side (no server, matching
 * every other document in this app) and triggers a browser download. The
 * PDF is only rendered on click, not on mount — `usePDF()` starts with no
 * document, and `updateDocument` kicks off rendering the first time
 * someone actually asks for it, since building all 10 chapters + cover +
 * TOC is real work worth deferring.
 */
export function ManualDownloadButton({ children, ...buttonProps }: Omit<ButtonProps, 'onClick' | 'loading'>) {
  const [instance, updateDocument] = usePDF()
  const [requested, setRequested] = useState(false)

  useEffect(() => {
    if (requested && !instance.loading && instance.url) {
      const link = document.createElement('a')
      link.href = instance.url
      link.download = 'ImplaTrax-User-Manual.pdf'
      link.click()
      setRequested(false)
    }
  }, [requested, instance.loading, instance.url])

  const handleClick = () => {
    setRequested(true)
    updateDocument(<ManualDocument />)
  }

  return (
    <Button onClick={handleClick} loading={requested && instance.loading} disabled={requested && instance.loading} {...buttonProps}>
      {children ?? (
        <>
          <FileDown className="h-4 w-4" /> Download User Manual (PDF)
        </>
      )}
    </Button>
  )
}
