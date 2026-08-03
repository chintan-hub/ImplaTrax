import { Text } from '@react-pdf/renderer'
import {
  ChapterDivider, ChapterPage, SectionHeading, P, Lead, BulletList, NumberedList,
  InvariantCallout, WorkflowStepper, FieldTable, ScrewMotif,
} from '../components'
import { COLORS, FONT } from '../styles'

export function Chapter08Loans() {
  return (
    <>
      <ChapterDivider
        chapterNumber={8}
        title="Laboratory & Loans Workflow"
        description="Strictly B2B: components on loan move only between the workspace and dental laboratories — never patients, never vendors."
        screwMotif={<ScrewMotif width={200} color={COLORS.teal} strokeWidth={1.75} />}
      />
      <ChapterPage chapterNumber={8} chapterTitle="Laboratory & Loans Workflow">
        <Text style={{ fontFamily: FONT.bold, fontSize: 8, color: COLORS.tealDark, letterSpacing: 2, marginBottom: 6 }}>CHAPTER 8</Text>
        <Text style={{ fontFamily: FONT.bold, fontSize: 22, color: COLORS.slate900, marginBottom: 14 }}>Laboratory & Loans Workflow</Text>
        <Lead>
          A Loan tracks components that leave the workspace temporarily — surgical kits, trial components,
          consignment stock sent to a lab for a specific case — with an expectation that most of it comes back.
        </Lead>

        <SectionHeading number="8.1" title="Strict Domain Rule: Labs Only" />
        <InvariantCallout tone="danger" label="CRITICAL BUSINESS RULE" title="A loan can only be issued to a lab">
          Every Loan requires a valid <Text style={{ fontFamily: 'Courier', fontSize: 9.5 }}>labId</Text> referencing a real lab
          record in the workspace — the action is rejected if the ID doesn't resolve to one. Loans exist to model a
          specific, recurring B2B relationship (a clinic and the dental laboratories it works with); they are not a
          general-purpose "lend to anyone" mechanism. A patient or vendor is never a valid loan counterparty —
          component movement to a patient is always a Sale (Chapter 7), and movement from a vendor is always a
          Purchase Order receipt (Chapter 9).
        </InvariantCallout>

        <SectionHeading number="8.2" title="Issuing a Loan" />
        <WorkflowStepper
          steps={[
            { label: 'Select Lab', detail: 'Required — must be a real lab record' },
            { label: 'Add Products', detail: 'One or more lines, with quantity' },
            { label: 'Set Due Date', detail: 'Optional — loans can stay open' },
            { label: 'Issue Loan', detail: 'Stock deducted immediately' },
          ]}
        />
        <P>
          Issuing a loan deducts every line's quantity from stock right away and writes a{' '}
          <Text style={{ fontFamily: 'Courier', fontSize: 9.5, color: COLORS.tealDark }}>loan-out</Text> movement per line,
          referencing the loan's number (e.g. LN-2026-00012). Like sales, the combined requested quantity for a
          product across multiple lines is checked against real stock before the loan can be issued — and when
          Batch/Lot Tracking is on, a batch-tracked product requires a lot number captured at issuance, since
          traceability begins the moment stock leaves the building, not only when it returns.
        </P>

        <SectionHeading number="8.3" title="Tracking Open Loans & Processing Returns" />
        <FieldTable
          columns={['Loan Status', 'Meaning']}
          rows={[
            { field: 'Open', description: 'Issued, nothing returned or reported lost yet.' },
            { field: 'Partially Returned', description: 'Some, but not all, of the loaned quantity has been accounted for.' },
            { field: 'Closed', description: 'Every unit loaned has been either returned or reported lost — nothing left outstanding.' },
          ]}
        />
        <P>
          A return is processed per line: enter how many units came back, and separately, how many are being
          reported lost. Returned quantity restores directly to stock and writes a{' '}
          <Text style={{ fontFamily: 'Courier', fontSize: 9.5, color: COLORS.tealDark }}>loan-return</Text> movement; lost
          quantity does <Text style={{ fontFamily: FONT.bold }}>not</Text> restore stock — it was already deducted at issuance —
          but is recorded with its own <Text style={{ fontFamily: 'Courier', fontSize: 9.5, color: COLORS.tealDark }}>lost</Text> movement
          documenting the disposition.
        </P>
        <InvariantCallout tone="amber" label="MANDATORY FIELD" title="A reason is required for every lost component">
          Reporting any quantity as lost on a return is rejected without a typed reason — every unit that doesn't
          come back has a documented explanation attached to it permanently, the same discipline applied everywhere
          else stock is corrected outside the normal flow.
        </InvariantCallout>
        <NumberedList
          items={[
            'Partial returns are fully supported — a loan can be returned against multiple times over its life, each partial return appending its own entry to the loan\'s history.',
            'A loan automatically moves to Closed the moment returned + lost quantity accounts for every unit originally loaned, across every line.',
            'A closed loan cannot be returned against again — attempting to do so is rejected by the same guard logic that governs every other terminal-state record in ImplaTrax.',
          ]}
        />

        <SectionHeading number="8.4" title="White-Label Loan Documents" />
        <P>
          Both the initial Loan Challan (what was issued) and the Return Delivery Slip (what came back) follow the
          same white-label hierarchy as Sales documents in Chapter 7 — the workspace's own logo and identity lead
          the header, with ImplaTrax reduced to a small "Powered by" footer mark.
        </P>
        <BulletList
          items={[
            'Optional photo attachments can be added at loan issuance and again at return — useful for recording component condition or a signed physical delivery slip — and are linked to the specific inventory movement(s) that action created.',
          ]}
        />
      </ChapterPage>
    </>
  )
}
