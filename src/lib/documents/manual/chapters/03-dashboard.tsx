import { Text } from '@react-pdf/renderer'
import {
  ChapterDivider, ChapterPage, SectionHeading, P, Lead, BulletList,
  InfoCardGrid, ScreenshotFrame, InvariantCallout, ScrewMotif,
} from '../components'
import { COLORS, FONT } from '../styles'

export function Chapter03Dashboard() {
  return (
    <>
      <ChapterDivider
        chapterNumber={3}
        title="The Core Dashboard"
        description="One screen, six real-time signals — what changed, what's low, and what's still open, the moment you log in."
        screwMotif={<ScrewMotif width={200} color={COLORS.teal} strokeWidth={1.75} />}
      />
      <ChapterPage chapterNumber={3} chapterTitle="The Core Dashboard">
        <Text style={{ fontFamily: FONT.bold, fontSize: 8, color: COLORS.tealDark, letterSpacing: 2, marginBottom: 6 }}>CHAPTER 3</Text>
        <Text style={{ fontFamily: FONT.bold, fontSize: 22, color: COLORS.slate900, marginBottom: 14 }}>The Core Dashboard</Text>
        <Lead>
          The Dashboard is deliberately the first thing every workspace member sees after unlocking ImplaTrax — a
          live snapshot of the numbers that matter, computed directly from the same append-only data every other
          chapter of this guide describes, never a cached or delayed summary.
        </Lead>

        <SectionHeading number="3.1" title="Real-Time KPI Cards" />
        <P>Six cards sit across the top of the dashboard, each reading directly from current workspace state:</P>
        <InfoCardGrid
          columns={2}
          items={[
            { title: 'Inventory Value', description: 'Total on-hand stock valued at unit cost across every product — the true replacement value of what’s on the shelf right now.' },
            { title: 'Low Stock Items', description: 'A live count of active products at or below their configured reorder threshold — the same set that drives the sidebar’s low-stock alerts.' },
            { title: 'Open Loans', description: 'Loans currently issued to labs that are not yet fully returned or closed — your outstanding B2B exposure at a glance.' },
            { title: 'Pending Purchase Orders', description: 'Draft, submitted, confirmed, and partially-received orders — everything still short of a full receipt.' },
            { title: 'Cases This Month', description: 'Clinical cases created in the current calendar month, a fast read on chairside volume.' },
            { title: 'Revenue (30d)', description: 'Total value of non-voided sales recorded in the trailing 30 days.' },
          ]}
        />

        <SectionHeading number="3.2" title="Trend Charts" />
        <BulletList
          items={[
            <Text key="1"><Text style={{ fontFamily: FONT.bold }}>Stock Movements</Text> — inbound vs. outbound quantity over the last 14 days, drawn straight from the inventory movement ledger described in Chapter 5.</Text>,
            <Text key="2"><Text style={{ fontFamily: FONT.bold }}>Inventory Value by Manufacturer</Text> — current stock valuation broken out across your product catalog’s manufacturer field, useful for spotting where capital is concentrated.</Text>,
          ]}
        />
        <ScreenshotFrame
          title="Dashboard — KPI row + trend charts"
          caption="Every number here is a live read of current workspace state, not a nightly batch export."
          callouts={[
            { number: 1, text: 'KPI cards — Inventory Value, Low Stock, Open Loans, Pending POs, Cases This Month, Revenue.' },
            { number: 2, text: 'Stock Movements chart — inbound vs. outbound quantity, last 14 days.' },
            { number: 3, text: 'Inventory Value by Manufacturer — a horizontal bar breakdown by brand.' },
          ]}
        />

        <SectionHeading number="3.3" title="Global Keyboard Search" />
        <P>
          Press <Text style={{ fontFamily: FONT.bold }}>Ctrl+K</Text> (or <Text style={{ fontFamily: FONT.bold }}>Cmd+K</Text> on
          macOS) from anywhere in ImplaTrax to open Global Search — a single command palette that searches across
          product names, SKUs, barcodes, patients, and clinical case IDs simultaneously, and jumps straight to the
          matching record. It's the fastest way to answer "do we have this part" or "which case is this component
          tied to" without leaving whatever screen you're currently on.
        </P>
        <InvariantCallout tone="teal" label="TIP" title="Barcode scanners work here too">
          Any USB or Bluetooth barcode scanner configured as a keyboard-emulation device can type a scanned barcode
          straight into Global Search — scan a physical component and ImplaTrax opens its product record instantly,
          no dedicated scanning mode required.
        </InvariantCallout>

        <SectionHeading number="3.4" title="Activity, Low Stock & Loan Widgets" />
        <BulletList
          items={[
            <Text key="1"><Text style={{ fontFamily: FONT.bold }}>Recent Activity</Text> — the newest inventory movements across the whole workspace, most recent first.</Text>,
            <Text key="2"><Text style={{ fontFamily: FONT.bold }}>Low Stock</Text> — every product at or below its reorder threshold, ranked so the most depleted items surface first.</Text>,
            <Text key="3"><Text style={{ fontFamily: FONT.bold }}>Outstanding Loans</Text> — open and partially-returned loans, so a lab relationship never quietly goes stale.</Text>,
          ]}
        />
      </ChapterPage>
    </>
  )
}
