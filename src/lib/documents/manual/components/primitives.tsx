import type { ReactNode } from 'react'
import { View, Text } from '@react-pdf/renderer'
import { COLORS, FONT } from '../styles'

export function SectionHeading({ number, title }: { number: string; title: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 20, marginBottom: 10 }} wrap={false}>
      <View style={{ width: 3, height: 16, backgroundColor: COLORS.teal, marginRight: 8 }} />
      <Text style={{ fontFamily: FONT.bold, fontSize: 8.5, color: COLORS.tealDark, marginRight: 8 }}>{number}</Text>
      <Text style={{ fontFamily: FONT.bold, fontSize: 13.5, color: COLORS.slate900 }}>{title}</Text>
    </View>
  )
}

export function SubHeading({ children }: { children: ReactNode }) {
  return <Text style={{ fontFamily: FONT.bold, fontSize: 11, color: COLORS.slate900, marginTop: 12, marginBottom: 5 }}>{children}</Text>
}

export function P({ children, style }: { children: ReactNode; style?: object }) {
  return <Text style={{ fontSize: 10.5, lineHeight: 1.55, color: COLORS.slate700, marginBottom: 8, ...style }}>{children}</Text>
}

export function Lead({ children }: { children: ReactNode }) {
  return <Text style={{ fontSize: 12, lineHeight: 1.6, color: COLORS.slate800, marginBottom: 10, fontFamily: FONT.regular }}>{children}</Text>
}

export function BulletList({ items }: { items: ReactNode[] }) {
  return (
    <View style={{ marginBottom: 8 }}>
      {items.map((item, i) => (
        <View key={i} style={{ flexDirection: 'row', marginBottom: 4.5 }} wrap={false}>
          <View style={{ width: 4, height: 4, backgroundColor: COLORS.teal, borderRadius: 2, marginTop: 4.5, marginRight: 8 }} />
          <Text style={{ fontSize: 10.5, lineHeight: 1.5, color: COLORS.slate700, flex: 1 }}>{item}</Text>
        </View>
      ))}
    </View>
  )
}

export function NumberedList({ items }: { items: ReactNode[] }) {
  return (
    <View style={{ marginBottom: 8 }}>
      {items.map((item, i) => (
        <View key={i} style={{ flexDirection: 'row', marginBottom: 6 }} wrap={false}>
          <View style={{ width: 16, height: 16, borderRadius: 8, backgroundColor: COLORS.slate900, alignItems: 'center', justifyContent: 'center', marginRight: 8, marginTop: 0.5 }}>
            <Text style={{ fontSize: 8, fontFamily: FONT.bold, color: COLORS.white }}>{i + 1}</Text>
          </View>
          <Text style={{ fontSize: 10.5, lineHeight: 1.5, color: COLORS.slate700, flex: 1 }}>{item}</Text>
        </View>
      ))}
    </View>
  )
}

interface FieldTableRow {
  field: string
  type?: string
  description: string
}

/** Field-by-field reference table — no native <table> in PDF layout, so rows are flex Views with a shared border, each locked with wrap={false} so a row never splits its field name from its description across a page break. */
export function FieldTable({ rows, columns = ['Field', 'Description'] }: { rows: FieldTableRow[]; columns?: [string, string] | [string, string, string] }) {
  const showType = columns.length === 3
  return (
    <View style={{ marginBottom: 12, borderWidth: 0.75, borderColor: COLORS.slate200, borderRadius: 4 }}>
      <View style={{ flexDirection: 'row', backgroundColor: COLORS.slate100, paddingVertical: 5, paddingHorizontal: 8 }}>
        <Text style={{ width: showType ? '30%' : '34%', fontSize: 8.5, fontFamily: FONT.bold, color: COLORS.slate600, textTransform: 'uppercase', letterSpacing: 0.4 }}>{columns[0]}</Text>
        {showType && <Text style={{ width: '18%', fontSize: 8.5, fontFamily: FONT.bold, color: COLORS.slate600, textTransform: 'uppercase', letterSpacing: 0.4 }}>{columns[1]}</Text>}
        <Text style={{ flex: 1, fontSize: 8.5, fontFamily: FONT.bold, color: COLORS.slate600, textTransform: 'uppercase', letterSpacing: 0.4 }}>{columns[showType ? 2 : 1]}</Text>
      </View>
      {rows.map((row, i) => (
        <View
          key={row.field}
          wrap={false}
          style={{
            flexDirection: 'row',
            paddingVertical: 6,
            paddingHorizontal: 8,
            borderTopWidth: 0.75,
            borderTopColor: COLORS.slate200,
            backgroundColor: i % 2 === 1 ? COLORS.slate50 : COLORS.white,
          }}
        >
          <Text style={{ width: showType ? '30%' : '34%', fontSize: 9.5, fontFamily: FONT.bold, color: COLORS.slate900 }}>{row.field}</Text>
          {showType && <Text style={{ width: '18%', fontSize: 9, color: COLORS.tealDark, fontFamily: 'Courier' }}>{row.type}</Text>}
          <Text style={{ flex: 1, fontSize: 9.5, lineHeight: 1.45, color: COLORS.slate600 }}>{row.description}</Text>
        </View>
      ))}
    </View>
  )
}

export function Divider() {
  return <View style={{ height: 0.75, backgroundColor: COLORS.slate200, marginVertical: 14 }} />
}

interface InfoCardItem {
  title: string
  description: string
  accent?: 'teal' | 'slate'
}

/** The paired/grid "info card" pattern — a light card with a colored top accent bar, a bold title, and a short description. Used for KPI tiles, role summaries, and any set of parallel short concepts that read better side-by-side than as a bullet list. */
export function InfoCardGrid({ items, columns = 2 }: { items: InfoCardItem[]; columns?: 2 | 4 }) {
  const widthPct = columns === 4 ? '23.5%' : '48.5%'
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginBottom: 10 }}>
      {items.map((item, i) => (
        <View
          key={i}
          wrap={false}
          style={{
            width: widthPct,
            backgroundColor: COLORS.slate50,
            borderTopWidth: 2.5,
            borderTopColor: item.accent === 'slate' ? COLORS.slate800 : COLORS.teal,
            borderRadius: 3,
            padding: 10,
            marginBottom: 10,
          }}
        >
          <Text style={{ fontFamily: FONT.bold, fontSize: 10, color: COLORS.slate900, marginBottom: 4 }}>{item.title}</Text>
          <Text style={{ fontSize: 8.5, lineHeight: 1.4, color: COLORS.slate600 }}>{item.description}</Text>
        </View>
      ))}
    </View>
  )
}
