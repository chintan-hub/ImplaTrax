import { Text } from '@react-pdf/renderer'
import {
  ChapterDivider, ChapterPage, SectionHeading, P, Lead, NumberedList,
  InvariantCallout, WorkflowStepper, ScreenshotFrame, FieldTable, ScrewMotif,
} from '../components'
import { COLORS, FONT } from '../styles'
import { MANUAL_SCREENSHOTS } from '../screenshots'

export function Chapter09VendorsPO() {
  return (
    <>
      <ChapterDivider
        chapterNumber={9}
        title="Vendors & Purchase Orders"
        description="From draft to received stock — including the mandatory photo-evidence rule that protects every partial delivery."
        screwMotif={<ScrewMotif width={200} color={COLORS.teal} strokeWidth={1.75} />}
      />
      <ChapterPage chapterNumber={9} chapterTitle="Vendors & Purchase Orders">
        <Text style={{ fontFamily: FONT.bold, fontSize: 8, color: COLORS.tealDark, letterSpacing: 2, marginBottom: 6 }}>CHAPTER 9</Text>
        <Text style={{ fontFamily: FONT.bold, fontSize: 22, color: COLORS.slate900, marginBottom: 14 }}>Vendors & Purchase Orders</Text>
        <Lead>
          Stock enters ImplaTrax through exactly one door: a Purchase Order being received. This chapter covers
          vendor profiles, the full PO lifecycle, and the mandatory-photo rule that governs every partial delivery.
        </Lead>

        <SectionHeading number="9.1" title="Vendor Profiles" />
        <P>
          A vendor record holds contact details, country, and — critically — the set of manufacturers that vendor
          supplies. That manufacturer association is what lets a purchase order line suggest the right vendor for a
          given product automatically, and lets Reports break spend down by supplier relationship rather than just
          by raw product.
        </P>

        <SectionHeading number="9.2" title="The Purchase Order Lifecycle" />
        <WorkflowStepper
          steps={[
            { label: 'Draft', detail: 'Created, editable, no stock impact' },
            { label: 'Submitted', detail: 'Sent to vendor' },
            { label: 'Confirmed', detail: 'Vendor acknowledged' },
            { label: 'Receiving', detail: 'Full or partial receipt(s)' },
            { label: 'Received', detail: 'Fully closed out' },
          ]}
        />
        <InvariantCallout tone="teal" label="ARCHITECTURE INVARIANT" title="A purchase order never touches inventory by itself">
          Creating, submitting, or confirming a purchase order only ever changes that order's own status and
          append-only history — never a product's stock. Inventory changes exactly once a receipt is recorded
          against it, and not a moment before. A draft PO for 500 units has zero effect on what the Dashboard reports
          as on-hand.
        </InvariantCallout>
        <P>
          A purchase order can also be <Text style={{ fontFamily: FONT.bold }}>cancelled</Text> — but only before it has been
          fully received; once every line is received, the order is closed out and can no longer be cancelled, since
          doing so would contradict inventory that has already physically arrived.
        </P>

        <SectionHeading number="9.3" title="Receiving Stock: Full vs. Partial" />
        <P>
          Receiving is where a purchase order actually affects inventory. For each line on the order, you enter how
          many units arrived — up to, but never exceeding, what's still outstanding for that line. A receipt is
          treated as <Text style={{ fontFamily: FONT.bold }}>partial</Text> the moment any line's received quantity comes in short
          of what was outstanding for it — whether that line was under-received this time, or skipped entirely while
          other lines on the same order were received in full. A receipt only counts as{' '}
          <Text style={{ fontFamily: FONT.bold }}>full</Text> when every line on the order is completely caught up.
        </P>
        <FieldTable
          rows={[
            { field: 'Full Receipt', description: 'Every line\'s received quantity now equals what was ordered. Order status moves to Received; photo evidence is optional.' },
            { field: 'Partial Receipt', description: 'At least one line remains short of its ordered quantity after this receipt. Order status moves to Partially Received; photo evidence is required — see 9.4.' },
          ]}
        />

        <SectionHeading number="9.4" title="Mandatory Photo Evidence for Partial Receipts" />
        <InvariantCallout tone="danger" label="CRITICAL BUSINESS RULE" title="A partial receipt cannot be submitted without a photo">
          Whenever a receipt is partial, ImplaTrax requires at least one photo of the delivery slip or the physical
          package before the receipt can be confirmed. The Confirm Receipt button stays disabled and a clear inline
          error is shown until a photo is attached; the same rule is enforced independently by the data layer — a
          partial receipt submitted with zero photos throws and nothing about the order or inventory is changed. A
          full receipt is never blocked this way; photos are optional once every line is fully caught up.
        </InvariantCallout>
        <P>
          The reasoning is straightforward: a partial delivery is exactly the moment a discrepancy — short-shipped
          units, a damaged carton, a substitution — is most likely, and hardest to reconstruct later from memory.
          Requiring photographic evidence at the moment of receipt turns "the vendor says they sent 50, we only got
          40" from a dispute into a documented fact.
        </P>
        <ScreenshotFrame
          title="Receive Purchase Order — partial receipt blocked"
          imageSrc={MANUAL_SCREENSHOTS.poReceivePartial}
          caption="Entering fewer units than remain outstanding on any line flips the photo field to required; Confirm Receipt stays disabled until at least one photo is attached."
          callouts={[
            { number: 1, text: 'Per-line quantity entry, capped at what remains outstanding for that line.' },
            { number: 2, text: '"Shipment Photos (Required for Partial Receipt)" — label and inline error change dynamically.' },
            { number: 3, text: 'Confirm Receipt — disabled until the photo requirement is satisfied.' },
          ]}
        />
        <NumberedList
          items={[
            'Photos attached to a receipt are linked to every inventory movement that receipt creates, and accumulate — append-only — on the purchase order itself across however many partial receipts it takes to fully close it out.',
            'When Batch/Lot Tracking is on, a lot number is required for every line being received in the same action — the photo requirement and the lot requirement are independent checks, both must pass to submit.',
            'Receiving a batch-tracked line with a lot number creates a Product Batch record and stamps that lot onto the resulting inventory movement, exactly as described in Chapter 5.',
          ]}
        />

        <SectionHeading number="9.5" title="Automatic Restocking & Movement History" />
        <P>
          Confirming any receipt — full or partial — immediately increases the affected products' on-hand quantity
          and writes one <Text style={{ fontFamily: 'Courier', fontSize: 9.5, color: COLORS.tealDark }}>inbound</Text> movement per
          line received, referencing the purchase order's number. There is no separate "apply to inventory" step;
          receiving and restocking are the same atomic action.
        </P>
      </ChapterPage>
    </>
  )
}
