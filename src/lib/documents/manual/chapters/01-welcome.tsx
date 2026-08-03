import { View, Text } from '@react-pdf/renderer'
import { ChapterDivider, ChapterPage, SectionHeading, P, Lead, BulletList, InvariantCallout, ScrewMotif } from '../components'
import { COLORS, FONT } from '../styles'

export function Chapter01Welcome() {
  return (
    <>
      <ChapterDivider
        chapterNumber={1}
        title="Welcome to ImplaTrax"
        description="The philosophy, architecture, and non-negotiable guarantees behind every screen in this product — read this chapter first, everything else builds on it."
        screwMotif={<ScrewMotif width={200} color={COLORS.teal} strokeWidth={1.75} />}
      />
      <ChapterPage chapterNumber={1} chapterTitle="Welcome to ImplaTrax">
        <Text style={{ fontFamily: FONT.bold, fontSize: 8, color: COLORS.tealDark, letterSpacing: 2, marginBottom: 6 }}>CHAPTER 1</Text>
        <Text style={{ fontFamily: FONT.bold, fontSize: 22, color: COLORS.slate900, marginBottom: 14 }}>Welcome to ImplaTrax</Text>

        <Lead>
          ImplaTrax is a professional, multi-tenant inventory and traceability platform purpose-built for dental
          implant practices, labs, and the vendors who supply them. It exists to answer one question with total
          confidence, at any moment, for any component: where is it, who touched it, and what happened to it — from
          the day it was received to the day it was placed in a patient.
        </Lead>

        <SectionHeading number="1.1" title="The Core Philosophy" />
        <View style={{ padding: 14, backgroundColor: COLORS.obsidian, borderRadius: 6, marginBottom: 12 }} wrap={false}>
          <Text style={{ fontFamily: FONT.bold, fontSize: 15, color: COLORS.white, lineHeight: 1.4 }}>
            "Every Component. Every Movement. Every Time."
          </Text>
        </View>
        <P>
          That line is not a slogan bolted onto a marketing page — it is the design constraint every module in this
          guide is built around. Every unit of stock ImplaTrax knows about is traceable to a specific product, at a
          specific quantity, moving for a specific, recorded reason. Nothing enters or leaves inventory silently.
          Nothing is ever just "corrected" without a note explaining why. If a number on a dashboard looks wrong, the
          full history of exactly how it got there is always one click away — never reconstructed, never guessed.
        </P>

        <SectionHeading number="1.2" title="Multi-Tenant Workspace Isolation" />
        <P>
          ImplaTrax runs on a shared, multi-tenant Supabase PostgreSQL database — every clinic, lab-facing account,
          and vendor-facing workspace lives in the same physical tables, but no workspace can ever see another
          workspace's data. This isn't a convention the application layer promises to respect; it's enforced by
          PostgreSQL Row Level Security (RLS) policies attached directly to every table, so even a bug in the
          front-end code, or a request crafted by hand against the API, cannot cross a workspace boundary.
        </P>
        <BulletList
          items={[
            <Text key="1">
              <Text style={{ fontFamily: FONT.bold }}>Every business table carries a </Text>
              <Text style={{ fontFamily: 'Courier', fontSize: 9.5, color: COLORS.tealDark }}>workspace_id</Text>
              <Text style={{ fontFamily: FONT.bold }}> column</Text> — products, purchase orders, sales, loans, patients,
              cases, inventory movements, and every other record are all scoped to exactly one workspace.
            </Text>,
            <Text key="2">
              A <Text style={{ fontFamily: 'Courier', fontSize: 9.5, color: COLORS.tealDark }}>auth_workspace_ids()</Text> policy
              function resolves which workspace(s) the currently signed-in user belongs to, and every RLS policy
              filters reads and writes against that set — a query simply cannot return rows outside it, regardless of
              what the client asks for.
            </Text>,
            <Text key="3">
              A person can belong to more than one workspace (e.g. a consultant supporting multiple clinics) and
              switches between them from the workspace picker — each workspace still keeps its own isolated products,
              team, PIN, and history.
            </Text>,
          ]}
        />
        <InvariantCallout tone="teal" label="ARCHITECTURE INVARIANT" title="Isolation is enforced at the database, not the UI">
          Row Level Security policies live on the PostgreSQL tables themselves. A workspace boundary in ImplaTrax is
          not "the app happens to only show you your own data" — it is "the database physically will not return
          another workspace's rows to your session, full stop."
        </InvariantCallout>

        <SectionHeading number="1.3" title="The Append-Only Traceability Principle" />
        <P>
          The single most important architectural decision in ImplaTrax is that history is never rewritten. Several
          tables exist purely to record what happened, in order, forever:
        </P>
        <BulletList
          items={[
            <Text key="1">
              <Text style={{ fontFamily: FONT.bold }}>Inventory Movements</Text> — every stock change (a purchase order
              receipt, a sale, a loan going out, a loan returning, a manual adjustment, a lost item) writes one
              immutable row capturing the exact quantity before and after the change, who performed it, and why.
              Rows are never edited or deleted; a correction is a new movement, not a rewritten old one.
            </Text>,
            <Text key="2">
              <Text style={{ fontFamily: FONT.bold }}>Purchase Order Events, Loan Events, Case Events</Text> — every
              status transition on a purchase order, loan, or clinical case appends one entry to that record's own
              audit trail. A purchase order's history always shows "Created, then Submitted, then Partially
              Received, then Received" in that exact order, because each line was written once and never touched again.
            </Text>,
            <Text key="3">
              <Text style={{ fontFamily: FONT.bold }}>The Workspace Audit Log</Text> — security-relevant events (logins,
              PIN changes, member role changes, workspace renames) are appended the same way, giving every workspace a
              complete, tamper-evident compliance trail.
            </Text>,
          ]}
        />
        <P>
          Practically, this means two things for anyone using the product: first, you can always answer "why does
          this product show 14 units on hand?" by reading its movement history top to bottom — the current quantity
          is nothing more than the running sum of every movement that ever touched it. Second, mistakes are corrected
          forward, never erased — voiding a sale or cancelling a purchase order adds new, clearly labeled history
          rather than pretending the original action never happened.
        </P>

        <SectionHeading number="1.4" title="Who This Guide Is For" />
        <P>
          This manual documents ImplaTrax exactly as it behaves in production against the multi-tenant Supabase
          backend — every field, every business rule, every workflow described here is the real, enforced behavior of
          the system, not a simplified summary. It is written for three audiences at once: the clinical/front-desk
          staff who use ImplaTrax every day to receive stock, record sales, and manage loans; the workspace owners and
          admins responsible for team access and settings; and the engineers who need a precise reference for the
          invariants the system guarantees. Chapters 2 through 10 can be read independently once you've read this
          one — each documents a single functional area end to end, field by field, rule by rule.
        </P>
      </ChapterPage>
    </>
  )
}
