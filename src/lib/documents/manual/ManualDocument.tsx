import { Document, Font } from '@react-pdf/renderer'
import { CoverPage, TableOfContents, type TocEntry } from './components'
import { Chapter01Welcome } from './chapters/01-welcome'
import { Chapter02GettingStarted } from './chapters/02-getting-started'
import { Chapter03Dashboard } from './chapters/03-dashboard'
import { Chapter04Catalog } from './chapters/04-catalog'
import { Chapter05Inventory } from './chapters/05-inventory'
import { Chapter06PatientsCases } from './chapters/06-patients-cases'
import { Chapter07Sales } from './chapters/07-sales'
import { Chapter08Loans } from './chapters/08-loans'
import { Chapter09VendorsPO } from './chapters/09-vendors-po'
import { Chapter10Settings } from './chapters/10-settings-security'

// react-pdf hyphenates long words that don't fit their line by default,
// which reads as a typo on a display-sized chapter title ("Engine"
// splitting into "En-" / "gine"). Registering an identity callback turns
// that off globally — a long word now wraps to the next line whole,
// never mid-word.
Font.registerHyphenationCallback((word) => [word])

const TOC_ENTRIES: TocEntry[] = [
  { number: 1, title: 'Welcome to ImplaTrax', description: 'Core philosophy, multi-tenant workspace isolation, and the append-only traceability principle.' },
  { number: 2, title: 'Getting Started & Authentication', description: '60-second onboarding, password vs. PIN, biometrics, and multi-device switching.' },
  { number: 3, title: 'The Core Dashboard', description: 'Real-time KPI cards, trend charts, and global keyboard search.' },
  { number: 4, title: 'Catalog & Product Taxonomy', description: 'Fixed vs. data-driven fields, SKU/barcode/QR generation, and bulk CSV import.' },
  { number: 5, title: 'Inventory & Traceability Engine', description: 'The append-only movement ledger, manual adjustments, batch/lot tracking, and the stock >= 0 invariant.' },
  { number: 6, title: 'Patients, Doctors & Clinical Cases', description: 'Doctor lookups, multi-case patients, and how placing a component creates a Sale atomically.' },
  { number: 7, title: 'Sales Workflow', description: 'The mandatory patient rule, white-label invoices, and sale immutability.' },
  { number: 8, title: 'Laboratory & Loans Workflow', description: 'The strict lab-only domain rule, partial returns, and lost-item accounting.' },
  { number: 9, title: 'Vendors & Purchase Orders', description: 'The PO lifecycle, and the mandatory photo-evidence rule for every partial receipt.' },
  { number: 10, title: 'Workspace Settings, Team & Security', description: 'White-label branding, least-privilege roles, device sessions, and the audit log.' },
]

function generatedOnLabel(): string {
  return new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
}

/**
 * The complete, assembled User Manual — a single @react-pdf/renderer
 * Document. Every chapter is its own component contributing a
 * ChapterDivider + ChapterPage pair; react-pdf paginates each ChapterPage
 * automatically as content overflows, repeating that chapter's fixed
 * running header/footer on every resulting physical page. All text is
 * real PDF text content (Text/Tspan primitives) — nothing here is ever
 * rasterized into an image, so the output is 100% selectable and
 * searchable.
 */
export function ManualDocument() {
  return (
    <Document title="ImplaTrax Professional SaaS User Guide" author="ImplaTrax" subject="ImplaTrax User Manual" creator="ImplaTrax">
      <CoverPage generatedOn={generatedOnLabel()} />
      <TableOfContents entries={TOC_ENTRIES} />
      <Chapter01Welcome />
      <Chapter02GettingStarted />
      <Chapter03Dashboard />
      <Chapter04Catalog />
      <Chapter05Inventory />
      <Chapter06PatientsCases />
      <Chapter07Sales />
      <Chapter08Loans />
      <Chapter09VendorsPO />
      <Chapter10Settings />
    </Document>
  )
}
