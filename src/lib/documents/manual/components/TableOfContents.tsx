import { Page, View, Text, Link } from '@react-pdf/renderer'
import { styles, COLORS, FONT } from '../styles'

export interface TocEntry {
  number: number
  title: string
  description: string
}

/**
 * Every entry is a real internal `<Link src="#chapter-N">` jumping to that
 * chapter's ChapterPage (which carries a matching `id`) — a page-numbered
 * TOC would need a two-pass render to know final page numbers ahead of
 * time; a clickable jump-link is the honest, equally (arguably more)
 * useful alternative for a PDF that's read on screen.
 */
export function TableOfContents({ entries }: { entries: TocEntry[] }) {
  return (
    <Page size="A4" style={styles.page}>
      <Text style={{ fontFamily: FONT.bold, fontSize: 8, color: COLORS.tealDark, letterSpacing: 2, marginBottom: 8 }}>CONTENTS</Text>
      <Text style={{ fontFamily: FONT.bold, fontSize: 22, color: COLORS.slate900, marginBottom: 24 }}>Table of Contents</Text>

      {entries.map((entry) => (
        <Link key={entry.number} src={`#chapter-${entry.number}`} style={{ textDecoration: 'none' }}>
          <View
            wrap={false}
            style={{
              flexDirection: 'row',
              alignItems: 'flex-start',
              paddingVertical: 12,
              borderBottomWidth: 0.75,
              borderBottomColor: COLORS.slate200,
            }}
          >
            <Text style={{ width: 34, fontFamily: FONT.bold, fontSize: 15, color: COLORS.slate300 }}>{String(entry.number).padStart(2, '0')}</Text>
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: FONT.bold, fontSize: 11.5, color: COLORS.slate900, marginBottom: 3 }}>{entry.title}</Text>
              <Text style={{ fontSize: 9.5, color: COLORS.slate500, lineHeight: 1.45 }}>{entry.description}</Text>
            </View>
          </View>
        </Link>
      ))}

      <View style={{ marginTop: 20, padding: 12, backgroundColor: COLORS.slate50, borderRadius: 5, borderWidth: 0.75, borderColor: COLORS.slate200 }}>
        <Text style={{ fontSize: 8.5, color: COLORS.slate500, lineHeight: 1.5 }}>
          This is an interactive PDF — every chapter above, and every cross-reference throughout the guide, is a
          clickable jump-link. Use your PDF reader's search (Ctrl/Cmd+F) to find any field, workflow, or business
          rule by name; every word in this document is real, selectable text.
        </Text>
      </View>
    </Page>
  )
}
