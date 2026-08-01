import { Page, View, Text, Image } from '@react-pdf/renderer'
import logoDark from '@/assets/logo-dark.png'
import { COLORS, FONT } from '../styles'
import { ScrewMotif } from './ScrewMotif'

const BRAND_TAGLINE = 'Every Component. Every Movement. Every Time.'

export function CoverPage({ generatedOn }: { generatedOn: string }) {
  return (
    <Page size="A4" style={{ backgroundColor: COLORS.obsidian, padding: 0 }}>
      <View
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: COLORS.obsidian,
        }}
      />
      {/* faint CAD grid — same architectural-drafting-table read as the login screen */}
      <View style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 400, opacity: 0.05 }}>
        {Array.from({ length: 10 }).map((_, i) => (
          <View key={`h${i}`} style={{ position: 'absolute', top: i * 40, left: 0, right: 0, height: 0.5, backgroundColor: COLORS.teal }} />
        ))}
        {Array.from({ length: 12 }).map((_, i) => (
          <View key={`v${i}`} style={{ position: 'absolute', top: 0, bottom: 0, left: i * 42, width: 0.5, backgroundColor: COLORS.teal }} />
        ))}
      </View>

      <View style={{ position: 'absolute', right: -30, top: 140, opacity: 0.9 }}>
        <ScrewMotif width={230} color={COLORS.teal} opacity={0.55} strokeWidth={1.75} />
      </View>

      <View style={{ position: 'absolute', top: 56, left: 56, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Image src={logoDark} style={{ width: 22, height: 22 }} />
        <Text style={{ fontFamily: FONT.bold, fontSize: 12, color: COLORS.white, letterSpacing: 0.3 }}>ImplaTrax</Text>
      </View>

      <View style={{ position: 'absolute', left: 56, top: 300, right: 200 }}>
        <Text style={{ fontFamily: FONT.bold, fontSize: 9.5, color: COLORS.teal, letterSpacing: 3, marginBottom: 16 }}>
          PROFESSIONAL SAAS USER GUIDE
        </Text>
        <Text style={{ fontFamily: FONT.bold, fontSize: 40, color: COLORS.white, lineHeight: 1.08, marginBottom: 20 }}>
          The Complete{'\n'}ImplaTrax{'\n'}User Manual
        </Text>
        <View style={{ width: 56, height: 3, backgroundColor: COLORS.teal, marginBottom: 20 }} />
        <Text style={{ fontSize: 12.5, color: COLORS.slate300, lineHeight: 1.6, maxWidth: 340 }}>{BRAND_TAGLINE}</Text>
        <Text style={{ fontSize: 10, color: COLORS.slate400, lineHeight: 1.6, maxWidth: 360, marginTop: 12 }}>
          Every module, workflow, and business invariant behind ImplaTrax's multi-tenant clinical
          inventory platform — from first login to production Supabase architecture.
        </Text>
      </View>

      <View style={{ position: 'absolute', left: 56, bottom: 56, right: 56, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <View>
          <Text style={{ fontSize: 8.5, color: COLORS.slate400, marginBottom: 2 }}>Version 1.0</Text>
          <Text style={{ fontSize: 8.5, color: COLORS.slate400 }}>Generated {generatedOn}</Text>
        </View>
        <Text style={{ fontSize: 8.5, color: COLORS.slate500 }}>implatrax.app</Text>
      </View>
    </Page>
  )
}
