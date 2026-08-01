import { Text } from '@react-pdf/renderer'
import {
  ChapterDivider, ChapterPage, SectionHeading, P, Lead, BulletList,
  FieldTable, InvariantCallout, ScreenshotFrame, ScrewMotif,
} from '../components'
import { COLORS, FONT } from '../styles'

export function Chapter05Inventory() {
  return (
    <>
      <ChapterDivider
        chapterNumber={5}
        title="Inventory & Traceability Engine"
        description="The append-only movement ledger that makes every unit of stock explainable, and the invariant that keeps it honest: stock can never go negative."
        screwMotif={<ScrewMotif width={200} color={COLORS.teal} strokeWidth={1.75} />}
      />
      <ChapterPage chapterNumber={5} chapterTitle="Inventory & Traceability Engine">
        <Text style={{ fontFamily: FONT.bold, fontSize: 8, color: COLORS.tealDark, letterSpacing: 2, marginBottom: 6 }}>CHAPTER 5</Text>
        <Text style={{ fontFamily: FONT.bold, fontSize: 22, color: COLORS.slate900, marginBottom: 14 }}>Inventory & Traceability Engine</Text>
        <Lead>
          Every quantity ImplaTrax shows you — a product's stock count, a workspace's total inventory value — is a
          derived number, never a manually maintained one. This chapter explains what actually produces it.
        </Lead>

        <SectionHeading number="5.1" title="The Append-Only Movement Ledger" />
        <P>
          Every single event that changes how much of a product is on hand — a purchase order receipt, a sale, a
          loan going out, a loan returning, a manual correction, a component reported lost — writes exactly one row
          to the <Text style={{ fontFamily: 'Courier', fontSize: 9.5, color: COLORS.tealDark }}>inventory_movements</Text> table.
          A product's current quantity is nothing more than the running sum of its movements; it is never stored or
          edited as an independent number that could drift out of sync with its own history.
        </P>
        <FieldTable
          columns={['Field', 'Type', 'Description']}
          rows={[
            { field: 'type', type: 'enum', description: 'inbound · outbound · adjustment · loan-out · loan-return · sale · lost' },
            { field: 'quantity', type: 'signed integer', description: 'Positive = stock increase, negative = decrease — the exact delta this one event applied.' },
            { field: 'quantityBefore / quantityAfter', type: 'integer', description: 'A full snapshot of the product\'s stock immediately before and after this movement — self-contained, never recomputed from other rows.' },
            { field: 'reason', type: 'text', description: 'Always present. System-generated for automated events ("Purchase order received"), required and operator-typed for manual adjustments.' },
            { field: 'reference', type: 'text, optional', description: 'The human-readable business document this movement belongs to — a PO number, Sale number, or Loan number.' },
            { field: 'performedBy', type: 'user id', description: 'Exactly who triggered this movement — attributed at write time, not reconstructed later.' },
          ]}
        />
        <InvariantCallout tone="teal" label="ARCHITECTURE INVARIANT" title="Movements are never edited or deleted">
          Correcting a mistake always means writing a new, clearly-reasoned movement — never editing or removing an
          old one. A product's full movement history is a permanent, chronological, tamper-evident record of
          everything that ever happened to it.
        </InvariantCallout>

        <SectionHeading number="5.2" title="Manual Stock Adjustments" />
        <P>
          Physical counts sometimes disagree with what ImplaTrax expects — damaged stock, a miscount, an item found
          in the wrong bin. The Adjust Stock action exists for exactly this, and it enforces one rule strictly:
        </P>
        <InvariantCallout tone="amber" label="MANDATORY FIELD" title="A reason is required for every manual adjustment">
          ImplaTrax rejects a manual stock adjustment with an empty or whitespace-only reason — this is enforced in
          the data layer itself, not only the form, so there is no code path that can silently correct a quantity
          without an explanation attached to it forever.
        </InvariantCallout>
        <P>
          An adjustment can move quantity in either direction, but the resulting on-hand quantity is always clamped
          at zero — see the invariant below.
        </P>

        <SectionHeading number="5.3" title="Batch/Lot Tracking & Expiry" />
        <P>
          Batch/Lot Tracking is a single workspace-wide switch in Clinic Settings — when it's on, every purchase
          order receipt requires a lot number for the line being received, regardless of whether that specific
          product is individually flagged as batch-tracked. Traceability, once it's turned on, begins at the moment
          stock enters the workspace and is never optional on a per-receipt basis.
        </P>
        <BulletList
          items={[
            <Text key="1">Each lot number received creates its own <Text style={{ fontFamily: FONT.bold }}>Product Batch</Text> record, carrying the quantity received, an optional expiry date, and the purchase order it came from.</Text>,
            <Text key="2">Receiving the <Text style={{ fontFamily: FONT.bold }}>same</Text> lot number across two separate deliveries creates two batch records, not one merged one — every receipt keeps its own point-in-time trail.</Text>,
            <Text key="3">The lot a component carries stays attached through Sales and Loans, so a specific implant placed in a specific patient can always be traced back to the exact delivery it arrived on.</Text>,
          ]}
        />

        <SectionHeading number="5.4" title="Barcode Lookup" />
        <P>
          A product's barcode is a first-class, indexed field, not just something printed on a label — typing or
          scanning a barcode value into Global Search (Chapter 3) jumps straight to that product's record, which is
          the fastest way to confirm identity and current stock before it's committed to a sale or loan.
        </P>

        <ScreenshotFrame
          title="Product detail — movement history"
          caption="Every row on this timeline is an immutable inventory_movements entry — the running total at the top is simply their sum."
          callouts={[
            { number: 1, text: 'Current quantity on hand, low-stock threshold, and batch-tracking status.' },
            { number: 2, text: 'Movement ledger — type, signed quantity, before/after snapshot, reason, and who performed it.' },
          ]}
        />

        <SectionHeading number="5.5" title="The Stock >= 0 Invariant" />
        <InvariantCallout tone="teal" label="DATABASE INVARIANT" title="Stock can never drop below zero">
          quantity_on_hand carries a database-level{' '}
          <Text style={{ fontFamily: 'Courier', fontSize: 9.5 }}>CHECK (quantity_on_hand &gt;= 0)</Text> constraint. No
          sale, loan, or adjustment — however it's requested — can push a product's stock negative; the operation is
          rejected (or, for a downward adjustment, the resulting quantity is clamped at zero) before it can ever
          leave inventory in an impossible state. Available-stock checks in the UI exist to give a friendly warning
          before that point, not as the only line of defense.
        </InvariantCallout>
      </ChapterPage>
    </>
  )
}
