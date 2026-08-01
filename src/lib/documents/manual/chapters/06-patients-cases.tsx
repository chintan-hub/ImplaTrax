import { Text } from '@react-pdf/renderer'
import {
  ChapterDivider, ChapterPage, SectionHeading, P, Lead, BulletList,
  FieldTable, InvariantCallout, WorkflowStepper, ScrewMotif,
} from '../components'
import { COLORS, FONT } from '../styles'

export function Chapter06PatientsCases() {
  return (
    <>
      <ChapterDivider
        chapterNumber={6}
        title="Patients, Doctors & Clinical Cases"
        description="Where inventory meets the clinic — how a case links a patient, a doctor, and the components actually placed."
        screwMotif={<ScrewMotif width={200} color={COLORS.teal} strokeWidth={1.75} />}
      />
      <ChapterPage chapterNumber={6} chapterTitle="Patients, Doctors & Clinical Cases">
        <Text style={{ fontFamily: FONT.bold, fontSize: 8, color: COLORS.tealDark, letterSpacing: 2, marginBottom: 6 }}>CHAPTER 6</Text>
        <Text style={{ fontFamily: FONT.bold, fontSize: 22, color: COLORS.slate900, marginBottom: 14 }}>Patients, Doctors & Clinical Cases</Text>
        <Lead>
          A Case is where ImplaTrax's inventory engine and clinical record-keeping meet — it is the record that
          proves which specific components ended up in which specific patient, under which doctor's care.
        </Lead>

        <SectionHeading number="6.1" title="Doctors" />
        <P>
          Doctors are a real, workspace-level lookup table — not a free-typed name repeated on every patient and
          case. A doctor is typically created inline, the first time their name is needed on a patient or case form,
          and from then on is reused everywhere via a searchable picker. This keeps "Dr. Alan Whitfield" spelled
          identically across every record he's associated with, which matters the moment you need to report on a
          single doctor's case volume or component usage.
        </P>
        <BulletList
          items={[
            'Doctors are never hard-deleted — a doctor no longer active at the practice is archived instead, disappearing from the picker for new selections while every existing patient/case record that already references them stays completely intact.',
          ]}
        />

        <SectionHeading number="6.2" title="Patients" />
        <FieldTable
          columns={['Field', 'Type', 'Description']}
          rows={[
            { field: 'patientCode', type: 'auto-generated', description: 'A short, human-readable identifier (e.g. PT-01042), assigned the moment the patient is created.' },
            { field: 'firstName / lastName / dob / sex', type: 'text / date / enum', description: 'Core identity fields for matching a patient record to the person in the chair.' },
            { field: 'phone / email', type: 'text, optional', description: 'Contact details, shown on the patient profile and searchable from Global Search.' },
            { field: 'primaryDoctor', type: 'text', description: 'The patient\'s usual treating doctor — a display string sourced from the Doctors lookup, distinct from any doctor recorded on an individual case.' },
          ]}
        />
        <P>
          A patient's profile aggregates every case ever opened for them, so a coordinator can see a person's
          complete implant history — not just the case currently in progress — from one screen.
        </P>

        <SectionHeading number="6.3" title="Clinical Cases" />
        <P>
          A single patient can have multiple cases running in parallel — a full-arch case and a separate
          single-tooth case, for instance — each tracked completely independently: its own status, its own doctor,
          its own list of components placed.
        </P>
        <WorkflowStepper
          steps={[
            { label: 'Planning', detail: 'Case opened, treatment plan taking shape' },
            { label: 'Surgery Scheduled', detail: 'Date set' },
            { label: 'In Progress', detail: 'Surgical phase underway' },
            { label: 'Restoration', detail: 'Prosthetic phase' },
            { label: 'Completed', detail: 'Treatment finished' },
          ]}
        />
        <P>
          Every case also carries an append-only history — status advances, and each implant added — recorded the
          same way a purchase order's or loan's history is (Chapter 1). A case can also be cancelled at any stage
          instead of progressing to completion; both Completed and Cancelled are terminal states the guard logic
          will not allow any further status transition out of.
        </P>

        <SectionHeading number="6.4" title="Adding a Component to a Case Is a Sale" />
        <P>
          Recording that an implant, abutment, or other component was placed in a patient during a case does not
          just add a line to a notes field — it atomically deducts the component from stock, writes an{' '}
          <Text style={{ fontFamily: 'Courier', fontSize: 9.5, color: COLORS.tealDark }}>outbound</Text> inventory movement, and
          creates a real Sale record linked to that patient and case, all as one indivisible action.
        </P>
        <InvariantCallout tone="teal" label="DATA INTEGRITY" title="A case's implant list can never drift out of sync with stock or sales">
          If the underlying Sale would fail for any reason — insufficient stock, for instance — the whole action is
          rejected before anything is written: the case's implant list, the product's stock, and the sales ledger
          either all update together or none of them do.
        </InvariantCallout>
        <P>
          Every implant recorded on a case carries the tooth number it was placed at (FDI notation, e.g. "36") and,
          when Batch/Lot Tracking is on, the exact lot it came from — giving a case a complete, component-level
          traceability record from delivery to placement.
        </P>
      </ChapterPage>
    </>
  )
}
