import type { ReactNode } from 'react'
import { useData } from '@/store/DataContext'
import { formatDateTime } from '@/lib/utils'
import { MICROCOPY } from '@/content/helpText'

/**
 * Every document type declares its own `kind` so the shared shell can give
 * it a distinct identity (accent rule weight/style + eyebrow label) without
 * each document having to hand-roll its own header chrome. Financial
 * documents (invoice-shaped, carry pricing/totals) get a solid, boxed
 * treatment; operational documents (goods movement, no pricing) get a
 * lighter, dashed treatment — the two should never be confusable at a
 * glance, even printed in pure black & white with "background graphics"
 * turned off (a common browser print default), which is why every
 * distinguishing mark here is a border/text treatment, never a color fill
 * alone.
 */
export type DocumentKind = 'invoice' | 'challan' | 'operational' | 'neutral'

interface MetaItem {
  label: string
  value: string
  /** Renders in a bordered, larger-type box — reserve for the 1-2 facts a reader needs first (document number, date). */
  highlight?: boolean
}

interface DocumentLayoutProps {
  title: string
  documentNumber: string
  kind?: DocumentKind
  /** Overrides the kind's default eyebrow label above the title. */
  eyebrow?: string
  meta?: MetaItem[]
  /** A full-width callout rendered between the header and the meta grid — used for the Delivery Challan's "not a tax invoice" notice. */
  banner?: ReactNode
  children: ReactNode
}

const KIND_RULE: Record<DocumentKind, string> = {
  invoice: 'border-b-[3px] border-slate-900',
  challan: 'border-b-[3px] border-dashed border-slate-500',
  operational: 'border-b-2 border-slate-700',
  neutral: 'border-b-2 border-slate-300',
}

const KIND_EYEBROW: Record<DocumentKind, string> = {
  invoice: 'Billing Document',
  challan: 'Dispatch Record',
  operational: 'Operational Record',
  neutral: 'Clinic Record',
}

/**
 * Shared print/PDF shell for every generated document. Reserves a slot for
 * a future clinic logo — none exists yet, so nothing renders there today.
 * Colors are plain neutral grays (not the app's themeable CSS variables) —
 * a printed document is always on white paper regardless of the app's
 * light/dark theme, so it shouldn't depend on that system at all.
 */
export function DocumentLayout({ title, documentNumber, kind = 'neutral', eyebrow, meta = [], banner, children }: DocumentLayoutProps) {
  const { clinicSettings } = useData()

  return (
    <div className="mx-auto max-w-[210mm] bg-white p-10 text-[13px] leading-relaxed text-slate-900">
      <div className={`flex items-start justify-between gap-8 pb-5 ${KIND_RULE[kind]}`}>
        <div>
          <p className="text-2xl font-bold tracking-tight">{clinicSettings.clinicName}</p>
          {clinicSettings.address && <p className="mt-1.5 text-slate-500">{clinicSettings.address}</p>}
          {(clinicSettings.phone || clinicSettings.email) && (
            <p className="text-slate-500">{[clinicSettings.phone, clinicSettings.email].filter(Boolean).join(' · ')}</p>
          )}
        </div>
        <div className="text-right">
          <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-slate-500">{eyebrow ?? KIND_EYEBROW[kind]}</p>
          <p className="mt-1 text-3xl font-bold tracking-tight">{title}</p>
          <p className="mt-1.5 font-mono text-sm text-slate-500">{documentNumber}</p>
        </div>
      </div>

      {banner && <div className="mt-5">{banner}</div>}

      {meta.length > 0 && (
        <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
          {meta.map((item) => (
            <div key={item.label} className={item.highlight ? 'rounded-md border-2 border-slate-900 px-3 py-2' : 'px-0.5'}>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">{item.label}</p>
              <p className={item.highlight ? 'mt-0.5 text-lg font-bold tracking-tight' : 'mt-0.5 font-medium'}>{item.value}</p>
            </div>
          ))}
        </div>
      )}

      <div className="mt-7">{children}</div>

      <div className="mt-14 flex items-end justify-between gap-6 border-t border-slate-200 pt-4 text-[11px] text-slate-400">
        <p>{MICROCOPY.documentFooter}</p>
        <p>Generated {formatDateTime(new Date())}</p>
      </div>
    </div>
  )
}
