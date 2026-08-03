import { Text } from '@react-pdf/renderer'
import {
  ChapterDivider, ChapterPage, SectionHeading, P, Lead, BulletList, NumberedList,
  FieldTable, InvariantCallout, WorkflowStepper, ScrewMotif,
} from '../components'
import { COLORS, FONT } from '../styles'

export function Chapter04Catalog() {
  return (
    <>
      <ChapterDivider
        chapterNumber={4}
        title="Catalog & Product Taxonomy"
        description="How ImplaTrax classifies every implant, abutment, and consumable — and what changes per product versus platform-wide."
        screwMotif={<ScrewMotif width={200} color={COLORS.teal} strokeWidth={1.75} />}
      />
      <ChapterPage chapterNumber={4} chapterTitle="Catalog & Product Taxonomy">
        <Text style={{ fontFamily: FONT.bold, fontSize: 8, color: COLORS.tealDark, letterSpacing: 2, marginBottom: 6 }}>CHAPTER 4</Text>
        <Text style={{ fontFamily: FONT.bold, fontSize: 22, color: COLORS.slate900, marginBottom: 14 }}>Catalog & Product Taxonomy</Text>
        <Lead>
          Every product ImplaTrax tracks is described the same way, whether it was typed in one at a time or arrived
          in a 500-row import — a consistent shape is what makes search, barcode lookup, and reporting reliable
          across an entire catalog.
        </Lead>

        <SectionHeading number="4.1" title="Fixed Taxonomy vs. Free-Text Fields" />
        <P>
          Two of a product's classification fields — <Text style={{ fontFamily: FONT.bold }}>Manufacturer</Text> and{' '}
          <Text style={{ fontFamily: FONT.bold }}>Category</Text> — come from a fixed, platform-wide list (six real-world
          implant manufacturers; ten component categories from Implant Fixture through Prosthetic Screw). This is
          deliberate: these are facts about the dental implant industry, not something one workspace should be able
          to define differently from another, so every workspace's reports and filters mean the same thing.{' '}
          <Text style={{ fontFamily: FONT.bold }}>System</Text> and <Text style={{ fontFamily: FONT.bold }}>Platform</Text>, by
          contrast, are free-text fields captured per product (e.g. "BLX", "TS III", "TiBase" for system; "NC",
          "RC", "WP" for platform) — genuinely data-driven, since implant systems and platform codes vary by
          manufacturer far more than can be usefully enumerated in a fixed list.
        </P>
        <FieldTable
          columns={['Field', 'Type', 'Description']}
          rows={[
            { field: 'manufacturer', type: 'fixed list', description: 'One of six real implant brands — the same list every workspace shares.' },
            { field: 'category', type: 'fixed list', description: 'One of ten component categories (Implant Fixture, Healing Abutment, Cover Screw, Bone Graft Material, etc).' },
            { field: 'system', type: 'free text', description: 'The manufacturer\'s implant line, e.g. "BLX", "TS III" — captured per product.' },
            { field: 'platform', type: 'free text, optional', description: 'Connection platform code, e.g. "NC" / "RC" / "WP" — varies by manufacturer and product.' },
            { field: 'diameterMm / lengthMm', type: 'number, optional', description: 'Physical dimensions, shown wherever a product is listed so the right size is never guessed.' },
          ]}
        />

        <SectionHeading number="4.2" title="Identity: SKU, Barcode & QR" />
        <P>
          Three identifiers are generated automatically the moment a product is created and never need to be typed
          by hand:
        </P>
        <BulletList
          items={[
            <Text key="1"><Text style={{ fontFamily: FONT.bold }}>SKU</Text> — composed from the manufacturer, system, and a sequence number (e.g. <Text style={{ fontFamily: 'Courier' }}>STR-BLX-014</Text>), unique within the workspace.</Text>,
            <Text key="2"><Text style={{ fontFamily: FONT.bold }}>Barcode</Text> — a CODE128-compatible value, rendered as a scannable barcode on every printed document and product label.</Text>,
            <Text key="3"><Text style={{ fontFamily: FONT.bold }}>QR Payload</Text> — encodes the product's SKU and internal ID, giving a phone camera a fast path straight to the correct product record.</Text>,
          ]}
        />

        <SectionHeading number="4.3" title="Pricing & Visibility" />
        <FieldTable
          rows={[
            { field: 'unitCost', description: 'What the workspace pays the vendor — drives Inventory Value on the Dashboard.' },
            { field: 'unitPrice', description: 'What the workspace charges the patient — used as the default line price on a new Sale.' },
            { field: 'priceVisible', description: 'A per-product toggle for whether pricing shows to staff by default; the workspace-wide "Price Visibility" setting in Clinic Settings supplies the default for new products.' },
            { field: 'lowStockThreshold', description: 'The quantity at or below which this product is flagged as low stock — feeds the Dashboard, the sidebar alert, and Reports.' },
            { field: 'batchTracked', description: 'Whether this specific product participates in lot/batch capture — only meaningful when the workspace-wide Batch/Lot Tracking setting is on (see Chapter 5).' },
          ]}
        />

        <SectionHeading number="4.4" title="Bulk CSV Import" />
        <P>
          Migrating from a spreadsheet, or seeding a large catalog in one pass, goes through the CSV importer rather
          than one-at-a-time product creation.
        </P>
        <WorkflowStepper
          steps={[
            { label: 'Prepare CSV', detail: 'One row per product, columns matching the catalog fields above' },
            { label: 'Upload & Validate', detail: 'Every row is checked before anything is written' },
            { label: 'Review Errors', detail: 'Invalid rows are listed with the exact reason' },
            { label: 'Commit Import', detail: 'Only valid rows are created, atomically' },
          ]}
        />
        <InvariantCallout tone="teal" label="DATA INTEGRITY" title="A bad row never blocks a good one — but validation runs first">
          The importer validates every row up front and shows exactly which rows would fail and why, before
          anything is written to the catalog. You choose to fix the file and re-upload, or proceed with only the
          valid rows — there is no partial-write state where some rows silently succeed while others silently fail.
        </InvariantCallout>
        <NumberedList
          items={[
            'Manufacturer and Category values in the file must match ImplaTrax\'s fixed lists exactly (case-insensitive) — anything else is flagged as an error rather than silently dropped or guessed.',
            'Newly imported products immediately get their SKU, barcode, and QR payload generated the same way a manually created product does.',
            'If any imported product starts with a non-zero quantity, that quantity is recorded as an "Initial stock on bulk import" inbound movement — the append-only ledger never has a product appear with stock and no explanation for it.',
          ]}
        />
      </ChapterPage>
    </>
  )
}
