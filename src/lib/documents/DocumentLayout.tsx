import type { ReactNode } from 'react'
import { useData } from '@/store/DataContext'
import { formatDateTime } from '@/lib/utils'
import { MICROCOPY } from '@/content/helpText'

interface DocumentLayoutProps {
  title: string
  documentNumber: string
  meta?: { label: string; value: string }[]
  children: ReactNode
}

/**
 * Shared print/PDF shell for every generated document. Reserves a slot for a
 * future clinic logo — none exists yet, so nothing renders there today.
 */
export function DocumentLayout({ title, documentNumber, meta = [], children }: DocumentLayoutProps) {
  const { clinicSettings } = useData()

  return (
    <div className="bg-white p-8 text-sm text-black">
      <div className="flex items-start justify-between gap-6 border-b border-border pb-4">
        <div>
          <p className="text-lg font-semibold">{clinicSettings.clinicName}</p>
          {clinicSettings.address && <p className="text-muted-foreground">{clinicSettings.address}</p>}
          {(clinicSettings.phone || clinicSettings.email) && (
            <p className="text-muted-foreground">{[clinicSettings.phone, clinicSettings.email].filter(Boolean).join(' · ')}</p>
          )}
        </div>
        <div className="text-right">
          <p className="text-xl font-semibold tracking-tight">{title}</p>
          <p className="font-mono text-muted-foreground">{documentNumber}</p>
        </div>
      </div>

      {meta.length > 0 && (
        <div className="grid grid-cols-2 gap-x-6 gap-y-3 border-b border-border py-4 sm:grid-cols-4">
          {meta.map((item) => (
            <div key={item.label}>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">{item.label}</p>
              <p className="font-medium">{item.value}</p>
            </div>
          ))}
        </div>
      )}

      <div className="py-4">{children}</div>

      <div className="mt-8 border-t border-border pt-3 text-xs text-muted-foreground">
        <p>{MICROCOPY.documentFooter}</p>
        <p>Generated {formatDateTime(new Date())}</p>
      </div>
    </div>
  )
}
