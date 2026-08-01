import type { ReactNode } from 'react'
import { View, Text, Svg, Path, Circle, Polygon } from '@react-pdf/renderer'
import { COLORS, FONT } from '../styles'

type Tone = 'teal' | 'amber' | 'danger'

const TONE = {
  teal: { border: COLORS.teal, bg: COLORS.tealPale, icon: COLORS.tealDark, label: COLORS.tealDark },
  amber: { border: COLORS.amber500, bg: COLORS.amber50, icon: COLORS.amber700, label: COLORS.amber700 },
  danger: { border: '#F87171', bg: COLORS.danger50, icon: COLORS.danger600, label: COLORS.danger600 },
} as const

function ToneIcon({ tone, color }: { tone: Tone; color: string }) {
  if (tone === 'amber') {
    // Warning triangle with an exclamation mark.
    return (
      <Svg width={16} height={16} viewBox="0 0 24 24">
        <Polygon points="12,3 22,20 2,20" stroke={color} strokeWidth={1.8} fill="none" />
        <Path d="M12,9.5 L12,14.5" stroke={color} strokeWidth={1.8} />
        <Circle cx={12} cy={17.3} r={0.9} fill={color} />
      </Svg>
    )
  }
  if (tone === 'danger') {
    return (
      <Svg width={16} height={16} viewBox="0 0 24 24">
        <Circle cx={12} cy={12} r={9.5} stroke={color} strokeWidth={1.8} fill="none" />
        <Path d="M8.5,8.5 L15.5,15.5 M15.5,8.5 L8.5,15.5" stroke={color} strokeWidth={1.8} />
      </Svg>
    )
  }
  // Rule / invariant — shield with a checkmark.
  return (
    <Svg width={16} height={16} viewBox="0 0 24 24">
      <Path d="M12,2.5 L20.5,6 L20.5,12 C20.5,17 17,20.5 12,21.5 C7,20.5 3.5,17 3.5,12 L3.5,6 Z" stroke={color} strokeWidth={1.6} fill="none" />
      <Path d="M8,12.2 L11,15.2 L16.5,9" stroke={color} strokeWidth={1.8} fill="none" />
    </Svg>
  )
}

/**
 * The "Invariant Callout Box" — used throughout the manual for the
 * business rules the app enforces server-side, not just in the UI (e.g.
 * mandatory patient linking, stock >= 0, mandatory partial-receipt
 * photos). Locked to a single page with wrap={false} — these are always
 * short enough that letting one split mid-box would look broken.
 */
export function InvariantCallout({ tone = 'teal', label, title, children }: { tone?: Tone; label: string; title: string; children: ReactNode }) {
  const t = TONE[tone]
  return (
    <View
      wrap={false}
      style={{
        borderWidth: 1,
        borderColor: t.border,
        backgroundColor: t.bg,
        borderRadius: 5,
        padding: 12,
        marginVertical: 10,
        flexDirection: 'row',
      }}
    >
      <View style={{ width: 16, height: 16, marginRight: 10, marginTop: 1.5 }}>
        <ToneIcon tone={tone} color={t.icon} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontFamily: FONT.bold, fontSize: 8, color: t.label, letterSpacing: 1, marginBottom: 3 }}>{label}</Text>
        <Text style={{ fontFamily: FONT.bold, fontSize: 10.5, color: COLORS.slate900, marginBottom: 4 }}>{title}</Text>
        <Text style={{ fontSize: 9.5, lineHeight: 1.5, color: COLORS.slate700 }}>{children}</Text>
      </View>
    </View>
  )
}
