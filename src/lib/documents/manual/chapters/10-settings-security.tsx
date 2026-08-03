import { Text } from '@react-pdf/renderer'
import {
  ChapterDivider, ChapterPage, SectionHeading, P, Lead, BulletList,
  FieldTable, InvariantCallout, ScreenshotFrame, ScrewMotif,
} from '../components'
import { COLORS, FONT } from '../styles'
import { MANUAL_SCREENSHOTS } from '../screenshots'

export function Chapter10Settings() {
  return (
    <>
      <ChapterDivider
        chapterNumber={10}
        title="Workspace Settings, Team & Security"
        description="Brand identity, least-privilege team access, device sessions, and the audit log that ties it all together."
        screwMotif={<ScrewMotif width={200} color={COLORS.teal} strokeWidth={1.75} />}
      />
      <ChapterPage chapterNumber={10} chapterTitle="Workspace Settings, Team & Security">
        <Text style={{ fontFamily: FONT.bold, fontSize: 8, color: COLORS.tealDark, letterSpacing: 2, marginBottom: 6 }}>CHAPTER 10</Text>
        <Text style={{ fontFamily: FONT.bold, fontSize: 22, color: COLORS.slate900, marginBottom: 14 }}>Workspace Settings, Team & Security</Text>
        <Lead>
          Settings is where a workspace's identity, its team's access, and its security posture all live — every
          change here is scoped to your workspace alone, protected by the same Row Level Security boundary
          described in Chapter 1.
        </Lead>

        <SectionHeading number="10.1" title="Workspace Name & White-Label Logo" />
        <P>
          The Workspace Name field is shown throughout the app and on every exported document. A dedicated
          Workspace Logo card lets any workspace manager upload, change, or remove the workspace's logo at any
          time — independent of whether one was set during onboarding.
        </P>
        <ScreenshotFrame
          title="Settings / Workspace / Workspace Logo"
          imageSrc={MANUAL_SCREENSHOTS.settingsWorkspaceLogo}
          caption="Upload, Change, and Remove — the logo syncs live across the app the instant it changes, no save step or page reload required."
          callouts={[
            { number: 1, text: 'Live preview of the current logo, or a clean placeholder when none is set.' },
            { number: 2, text: 'Upload / Change — replaces the logo instantly.' },
            { number: 3, text: 'Remove — reverts every surface to the styled workspace-name fallback.' },
          ]}
        />
        <BulletList
          items={[
            'A newly uploaded logo appears immediately on every printed Sale, Loan, and Purchase Order document generated afterward — see the white-label hierarchy described in Chapters 7–9.',
            'The workspace logo is intentionally scoped to Settings and printed documents only — the in-app navigation shell (sidebar and top bar) always shows the ImplaTrax mark alone, so the product\'s own identity stays unambiguous while you\'re using it.',
          ]}
        />

        <SectionHeading number="10.2" title="Team Members & Least-Privilege Roles" />
        <FieldTable
          columns={['Role', 'Can manage workspace/team?']}
          rows={[
            { field: 'Owner', description: 'Full access — every workspace has exactly one, the account that completed onboarding.' },
            { field: 'Super Admin / Admin', description: 'Full workspace and team management — add/remove members, change roles, rename the workspace, upload the logo.' },
            { field: 'Manager', description: 'Day-to-day operational access without workspace-level administration rights.' },
            { field: 'Staff', description: 'Standard clinical/operational access.' },
            { field: 'Read Only', description: 'View access across the workspace, no create/edit/delete actions.' },
          ]}
        />
        <P>
          A team member is added by an Owner, Super Admin, or Admin, who issues their initial PIN directly — the
          fastest path to a new hire being productive on a shared clinic device the same day, without waiting on an
          email invitation round-trip.
        </P>
        <InvariantCallout tone="teal" label="SAFEGUARD" title="A workspace can never lose its last active Owner">
          ImplaTrax will not let the final active Owner be disabled, removed, or demoted while they're the only one
          left — a workspace can never accidentally end up with no one able to manage it.
        </InvariantCallout>

        <SectionHeading number="10.3" title="Device Sessions & PIN Resets" />
        <BulletList
          items={[
            <Text key="1"><Text style={{ fontFamily: FONT.bold }}>Reset PIN</Text> — a manager can force any team member to set a brand-new PIN on their next unlock, useful if a device is lost or a PIN is suspected compromised.</Text>,
            <Text key="2"><Text style={{ fontFamily: FONT.bold }}>Disable / Reactivate</Text> — revokes or restores a member's access without deleting their history — every record they ever touched stays attributed to them.</Text>,
            <Text key="3"><Text style={{ fontFamily: FONT.bold }}>Sessions & Devices</Text> — a per-device record of this browser install (a stable device ID), used to scope PINs and show recent activity.</Text>,
          ]}
        />
        <P>Three workspace-wide security preferences round out access control, all configurable from Settings, under Security:</P>
        <FieldTable
          rows={[
            { field: 'Auto-Lock', description: 'Minutes of inactivity before the app locks itself and returns to the PIN pad. Zero disables it.' },
            { field: 'Session Timeout', description: 'An absolute cap, in minutes, on how long a session stays valid since the last unlock — regardless of activity.' },
            { field: 'Lockout', description: 'Maximum consecutive failed PIN attempts before a timed lockout, and how long that lockout lasts.' },
          ]}
        />

        <SectionHeading number="10.4" title="The Append-Only System Audit Log" />
        <P>
          Every security-relevant event — logins, lockouts, PIN changes and resets, biometric enrollment, member
          additions/removals/role changes, workspace renames — is appended to the workspace's Activity Log the same
          way every other history table in ImplaTrax works: written once, in order, never edited or removed.
        </P>
        <InvariantCallout tone="teal" label="COMPLIANCE" title="A complete, tamper-evident trail for every workspace">
          Because the audit log is append-only and scoped by the same Row Level Security boundary as every other
          table, it gives each workspace an accurate, complete record of who did what and when — without any
          workspace being able to see, or worry about, another workspace's activity.
        </InvariantCallout>
      </ChapterPage>
    </>
  )
}
