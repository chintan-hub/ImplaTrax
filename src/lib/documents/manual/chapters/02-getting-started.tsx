import { Text } from '@react-pdf/renderer'
import {
  ChapterDivider, ChapterPage, SectionHeading, P, Lead, BulletList, NumberedList,
  InvariantCallout, WorkflowStepper, ScreenshotFrame, FieldTable, ScrewMotif,
} from '../components'
import { COLORS, FONT } from '../styles'

export function Chapter02GettingStarted() {
  return (
    <>
      <ChapterDivider
        chapterNumber={2}
        title="Getting Started & Authentication"
        description="From a clean-slate workspace to a fast, secure daily unlock — how ImplaTrax onboards a new team and keeps the operatory moving."
        screwMotif={<ScrewMotif width={200} color={COLORS.teal} strokeWidth={1.75} />}
      />
      <ChapterPage chapterNumber={2} chapterTitle="Getting Started & Authentication">
        <Text style={{ fontFamily: FONT.bold, fontSize: 8, color: COLORS.tealDark, letterSpacing: 2, marginBottom: 6 }}>CHAPTER 2</Text>
        <Text style={{ fontFamily: FONT.bold, fontSize: 22, color: COLORS.slate900, marginBottom: 14 }}>Getting Started & Authentication</Text>
        <Lead>
          ImplaTrax separates two very different login moments: the one-time act of standing up a brand-new
          workspace, and the dozens of times a day a busy clinical team needs to get back into the app in under two
          seconds. Both are covered in this chapter.
        </Lead>

        <SectionHeading number="2.1" title="60-Second Workspace Onboarding" />
        <P>
          A brand-new ImplaTrax workspace starts genuinely empty — there is no pre-installed product catalog, no
          sample vendors, and no placeholder patients to delete before you can trust what you see. Onboarding exists
          to get one real admin account and one real workspace name created, nothing more.
        </P>
        <WorkflowStepper
          steps={[
            { label: 'Workspace & Account', detail: 'Workspace name, your name, email, password' },
            { label: 'PIN Setup', detail: 'Create and confirm a 4-digit PIN' },
            { label: 'About Your Practice', detail: 'Optional: company name, logo, country, currency' },
            { label: 'Start Using ImplaTrax', detail: 'Land straight on an empty Dashboard' },
          ]}
        />
        <P>
          Every field on the "About Your Practice" step is explicitly optional — company name, workspace logo,
          country, and currency can all be filled in later from Settings without blocking the first login. The only
          two things onboarding requires are a workspace name and a working account (name, email, password) for the
          person setting it up, who becomes that workspace's <Text style={{ fontFamily: FONT.bold }}>Owner</Text>.
        </P>
        <ScreenshotFrame
          title="Onboarding — Account step"
          caption="The account step collects the workspace name and the owner's credentials in a single, focused screen."
          callouts={[
            { number: 1, text: 'Workspace name — shown throughout the app and on every exported document.' },
            { number: 2, text: 'Email + password — the account-level credential used to log in on a new device.' },
            { number: 3, text: 'A 4-digit device PIN is created on the next step, for fast local unlock.' },
          ]}
        />

        <SectionHeading number="2.2" title="Two Ways to Sign In: Password vs. Device PIN" />
        <FieldTable
          columns={['Method', 'Best for', 'How it works']}
          rows={[
            { field: 'Email + Password', type: 'New device / new team member', description: 'The account-level credential. Used the first time a person signs in on a given device, or when a device has no PIN set for them yet.' },
            { field: '4-Digit PIN', type: 'The daily clinical-operatory unlock', description: 'A fast, device-scoped code — set once per device per person. A PIN created on one device is never valid on another; a new device always starts with a password sign-in.' },
          ]}
        />
        <P>
          This split exists because a clinical front desk cannot afford to type a full password every time the app
          locks between patients. The PIN is deliberately short and fast, but it is also deliberately
          device-scoped — stealing a PIN is useless anywhere except the one physical device it belongs to.
        </P>
        <InvariantCallout tone="teal" label="SECURITY DESIGN" title="A PIN never travels between devices">
          Each team member's PIN is tied to a specific device ID. Signing in on a new tablet or workstation always
          starts with the account password, followed by creating a brand-new PIN for that device — an old device's
          PIN cannot be guessed or reused elsewhere.
        </InvariantCallout>

        <SectionHeading number="2.3" title="Biometric Authentication" />
        <P>
          Where the device supports it, ImplaTrax offers Touch ID, Face ID, or Windows Hello as a faster stand-in for
          the PIN, backed by the browser's WebAuthn platform authenticator API. Biometric unlock is opt-in per
          device and always has the PIN pad as a fallback — losing access to Face ID (a different person picking up
          the tablet, for instance) never locks anyone out of typing their PIN instead.
        </P>

        <SectionHeading number="2.4" title="Multi-Device & Multi-Workspace Switching" />
        <NumberedList
          items={[
            'A team member can be added to a workspace by an Owner, Super Admin, or Admin, who issues them an initial PIN directly — no email invitation loop required to get someone working on a shared device.',
            'A single email account can belong to more than one workspace (for example, a lab technician who supports two clinics) — the account menu\'s workspace switcher moves between them without signing out.',
            'Locking the app (manually, or automatically after inactivity) always returns to the PIN pad for whoever is signed in — it never signs the whole device out to the workspace picker unless "Log Out" or "Switch User" is chosen explicitly.',
          ]}
        />
        <BulletList
          items={[
            <Text key="1"><Text style={{ fontFamily: FONT.bold }}>Auto-lock</Text> — configurable minutes of inactivity before the app locks itself (0 disables it).</Text>,
            <Text key="2"><Text style={{ fontFamily: FONT.bold }}>Session timeout</Text> — an absolute cap on how long a session stays valid since the last unlock, regardless of activity.</Text>,
            <Text key="3"><Text style={{ fontFamily: FONT.bold }}>Failed-attempt lockout</Text> — a maximum number of incorrect PIN attempts triggers a temporary, timed lockout before another attempt is allowed.</Text>,
          ]}
        />
        <P>All three of these are workspace-wide security preferences, configurable by a workspace manager from Settings, under Security — see Chapter 10.</P>
      </ChapterPage>
    </>
  )
}
