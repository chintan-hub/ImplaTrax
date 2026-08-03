import type { ReactNode } from 'react'
import { Page, View, Text, Image } from '@react-pdf/renderer'
import logo from '@/assets/logo.png'
import logoDark from '@/assets/logo-dark.png'
import { styles, COLORS } from '../styles'

interface ChapterPageProps {
  chapterNumber: number
  chapterTitle: string
  children: ReactNode
}

/**
 * Every chapter's content lives inside one `ChapterPage` — react-pdf
 * automatically splits overflowing content across as many physical pages
 * as it needs, and because the header/footer Views here carry `fixed`,
 * they repeat identically on every one of those pages. That's what keeps
 * "Chapter N — Title" accurate on every page belonging to this chapter,
 * and `render={({pageNumber, totalPages}) => ...}` is what makes "Page X
 * of Y" resolve against the whole finished document, not just this
 * chapter's own page count.
 */
export function ChapterPage({ chapterNumber, chapterTitle, children }: ChapterPageProps) {
  return (
    <Page size="A4" style={styles.page} id={`chapter-${chapterNumber}`} bookmark={`${chapterNumber}. ${chapterTitle}`}>
      <View fixed style={styles.runningHeader}>
        <Image src={logo} style={styles.runningHeaderLogo} />
        <Text style={styles.runningHeaderTitle}>Chapter {chapterNumber} — {chapterTitle}</Text>
      </View>

      {children}

      <View fixed style={styles.runningFooter}>
        <Text style={styles.footerLeft}>ImplaTrax Professional SaaS User Manual — Version 1.0</Text>
        <Text style={styles.footerRight} render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
      </View>
    </Page>
  )
}

/** Full-bleed chapter divider — its own physical page, obsidian background, large chapter number + title, screw motif accent. Precedes the chapter's own ChapterPage(s) so the reader gets a clear visual "new chapter" beat before the working content starts. */
export function ChapterDivider({ chapterNumber, title, description, screwMotif }: { chapterNumber: number; title: string; description: string; screwMotif: ReactNode }) {
  return (
    <Page size="A4" style={{ backgroundColor: COLORS.obsidian, padding: 0 }}>
      <View style={{ position: 'absolute', right: -50, top: 70, opacity: 0.14 }}>{screwMotif}</View>
      <Image src={logoDark} style={{ position: 'absolute', top: 56, left: 64, height: 20, objectFit: 'contain' }} />
      <View style={{ flex: 1, justifyContent: 'center', paddingLeft: 64, paddingRight: 90 }}>
        <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 11, color: COLORS.teal, letterSpacing: 2, marginBottom: 10 }}>
          CHAPTER {String(chapterNumber).padStart(2, '0')}
        </Text>
        <Text style={{ fontFamily: 'Helvetica-Bold', fontSize: 25, color: COLORS.white, marginBottom: 16, lineHeight: 1.2 }}>{title}</Text>
        <View style={{ width: 48, height: 2.5, backgroundColor: COLORS.teal, marginBottom: 16 }} />
        <Text style={{ fontSize: 11.5, color: COLORS.slate300, lineHeight: 1.6, maxWidth: 380 }}>{description}</Text>
      </View>
    </Page>
  )
}
