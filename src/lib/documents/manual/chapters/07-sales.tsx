import { Text } from '@react-pdf/renderer'
import {
  ChapterDivider, ChapterPage, SectionHeading, P, Lead, BulletList, NumberedList,
  InvariantCallout, WorkflowStepper, ScreenshotFrame, ScrewMotif,
} from '../components'
import { COLORS, FONT } from '../styles'
import { MANUAL_SCREENSHOTS } from '../screenshots'

export function Chapter07Sales() {
  return (
    <>
      <ChapterDivider
        chapterNumber={7}
        title="Sales Workflow"
        description="Clinical consumption, the mandatory patient rule, and the white-label documents every sale can generate."
        screwMotif={<ScrewMotif width={200} color={COLORS.teal} strokeWidth={1.75} />}
      />
      <ChapterPage chapterNumber={7} chapterTitle="Sales Workflow">
        <Text style={{ fontFamily: FONT.bold, fontSize: 8, color: COLORS.tealDark, letterSpacing: 2, marginBottom: 6 }}>CHAPTER 7</Text>
        <Text style={{ fontFamily: FONT.bold, fontSize: 22, color: COLORS.slate900, marginBottom: 14 }}>Sales Workflow</Text>
        <Lead>
          A Sale in ImplaTrax means one thing, unconditionally: a component was permanently placed in — or
          delivered to — a real patient. It is the system's clinical-consumption record, and it is built around one
          non-negotiable rule.
        </Lead>

        <SectionHeading number="7.1" title="The Mandatory Patient Rule" />
        <InvariantCallout tone="danger" label="CRITICAL BUSINESS RULE" title="A sale cannot exist without a patient">
          ImplaTrax has no concept of an anonymous or walk-in sale. Every Sale record requires a valid{' '}
          <Text style={{ fontFamily: 'Courier', fontSize: 9.5 }}>patientId</Text> — the action is rejected outright, before any
          stock is touched, if one isn't supplied. This is enforced in three independent places: the Record Sale
          form won't submit without a patient selected, the data layer rejects the action even if called directly,
          and the database schema itself makes <Text style={{ fontFamily: 'Courier', fontSize: 9.5 }}>sales.patient_id</Text> a
          not-null, foreign-key-constrained column. There is no path — UI, API, or direct database write — that
          produces a sale disconnected from a real patient.
        </InvariantCallout>
        <P>
          This exists because a Sale is ImplaTrax's medical traceability record — the whole point of the platform is
          being able to answer, with certainty, exactly which patient received a specific implant lot. A sale with
          no patient would be a permanent hole in that record.
        </P>

        <SectionHeading number="7.2" title="Recording a Sale, Step by Step" />
        <WorkflowStepper
          steps={[
            { label: 'Select Patient', detail: 'Required — search or create new' },
            { label: 'Link a Case', detail: 'Optional' },
            { label: 'Add Line Items', detail: 'Product, quantity, price, lot' },
            { label: 'Record Sale', detail: 'Stock deducted immediately' },
          ]}
        />
        <NumberedList
          items={[
            'Choose the patient the sale is for — an existing patient found via search, or a brand-new one created inline without losing any line items already entered.',
            'Optionally link the sale to one of that patient\'s existing clinical cases — sales linked to a case are labeled "Used in patient case" in the movement history; unlinked sales are labeled "Direct sale".',
            'Add one or more product lines, each with its own quantity and unit price (defaulting to the product\'s configured price, editable per line) — a batch/lot field appears automatically when Batch/Lot Tracking is on for a batch-tracked product.',
            'Every line\'s requested quantity is checked against current stock, combined across lines for the same product, before the sale can be submitted — you\'ll see exactly how many units are actually available if a line exceeds it.',
            'Submitting the sale deducts stock for every line, writes one \'sale\' movement per line, and generates the sale\'s number (e.g. SL-2026-00042) — all as a single atomic action.',
          ]}
        />

        <SectionHeading number="7.3" title="White-Label Document Generation" />
        <P>
          Every sale can produce a printable Sales Invoice and Delivery Challan, and both documents are built around
          a deliberate brand hierarchy: your workspace's own identity is the hero, ImplaTrax is a quiet footnote.
        </P>
        <ScreenshotFrame
          title="Sales Invoice — white-label header"
          imageSrc={MANUAL_SCREENSHOTS.salesInvoiceHeader}
          caption="The workspace's uploaded logo leads the header at full size; ImplaTrax appears only as a small 'Powered by' mark in the footer, roughly a quarter the size."
          callouts={[
            { number: 1, text: 'Workspace logo + clinic name/address — the primary, large-format brand.' },
            { number: 2, text: 'Invoice number, patient, case reference, and line items.' },
            { number: 3, text: '"Powered by ImplaTrax" — small footer attribution, ~25% the size of the workspace logo.' },
          ]}
        />
        <BulletList
          items={[
            'If no workspace logo has been uploaded yet, the header falls back gracefully to a styled clinic name — the layout never shows an empty gap where a logo would go.',
            'A workspace logo uploaded or changed in Settings (Chapter 10) applies to every document generated from that point forward, immediately — no separate publish step.',
          ]}
        />

        <SectionHeading number="7.4" title="Sale Immutability & Reversal" />
        <P>
          A completed sale's line items, quantities, and prices are never edited after the fact — a sale is a
          permanent clinical record, not a draft. If a sale genuinely needs to be undone (an item was recorded in
          error, a patient declined treatment after checkout), the reversal path is <Text style={{ fontFamily: FONT.bold }}>Void</Text>,
          not edit or delete.
        </P>
        <InvariantCallout tone="teal" label="APPEND-ONLY DESIGN" title="Voiding restores stock without erasing the record">
          Voiding a sale requires a typed reason, restores every line's quantity back to stock, and marks the sale
          as voided with a timestamp and that reason — the original sale record stays fully visible for audit
          purposes, permanently excluded from revenue totals but never deleted. History is corrected forward, never
          rewritten (see Chapter 1).
        </InvariantCallout>
      </ChapterPage>
    </>
  )
}
