import { BookOpen, ShieldCheck, Search, Layers } from 'lucide-react'
import { StickyActionHeader } from '@/components/shared/StickyActionHeader'
import { Card, CardContent } from '@/components/ui/card'
import { ManualDownloadButton } from '@/components/manual/ManualDownloadButton'

const CHAPTERS = [
  { number: 1, title: 'Welcome to ImplaTrax', description: 'Core philosophy, multi-tenant isolation, and the append-only traceability principle.' },
  { number: 2, title: 'Getting Started & Authentication', description: '60-second onboarding, password vs. PIN, biometrics, multi-device switching.' },
  { number: 3, title: 'The Core Dashboard', description: 'Real-time KPI cards, trend charts, and global keyboard search.' },
  { number: 4, title: 'Catalog & Product Taxonomy', description: 'Fixed vs. data-driven fields, SKU/barcode/QR generation, bulk CSV import.' },
  { number: 5, title: 'Inventory & Traceability Engine', description: 'The movement ledger, manual adjustments, batch/lot tracking, stock ≥ 0.' },
  { number: 6, title: 'Patients, Doctors & Clinical Cases', description: 'Doctor lookups, multi-case patients, atomic implant-to-sale linking.' },
  { number: 7, title: 'Sales Workflow', description: 'The mandatory patient rule, white-label invoices, sale immutability.' },
  { number: 8, title: 'Laboratory & Loans Workflow', description: 'The strict lab-only domain rule, partial returns, lost-item accounting.' },
  { number: 9, title: 'Vendors & Purchase Orders', description: 'The PO lifecycle and the mandatory photo-evidence rule for partial receipts.' },
  { number: 10, title: 'Workspace Settings, Team & Security', description: 'White-label branding, least-privilege roles, sessions, the audit log.' },
]

const HIGHLIGHTS = [
  { icon: Search, label: '100% searchable', detail: 'Every word is real, selectable PDF text — never a flattened image.' },
  { icon: Layers, label: '10 in-depth chapters', detail: 'Field-by-field reference for every module and workflow.' },
  { icon: ShieldCheck, label: 'Every invariant explained', detail: 'The exact business rules ImplaTrax enforces, and why.' },
]

export function ManualPage() {
  return (
    <div>
      <StickyActionHeader
        title="User Manual"
        description="The complete, authoritative ImplaTrax user guide — every module, workflow, and business rule."
        actions={<ManualDownloadButton />}
      />

      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
        {HIGHLIGHTS.map((h) => (
          <Card key={h.label}>
            <CardContent className="flex items-start gap-3 pt-6">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary-700 dark:text-primary-300">
                <h.icon className="h-4.5 w-4.5" aria-hidden="true" />
              </div>
              <div>
                <p className="text-sm font-semibold">{h.label}</p>
                <p className="text-xs text-muted-foreground">{h.detail}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="mb-4 flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
            <p className="text-sm font-semibold">What's inside</p>
          </div>
          <div className="divide-y divide-border">
            {CHAPTERS.map((c) => (
              <div key={c.number} className="flex items-start gap-4 py-3.5 first:pt-0 last:pb-0">
                <span className="w-7 shrink-0 font-mono text-sm text-muted-foreground/70">{String(c.number).padStart(2, '0')}</span>
                <div className="min-w-0">
                  <p className="text-sm font-medium">{c.title}</p>
                  <p className="text-xs text-muted-foreground">{c.description}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
