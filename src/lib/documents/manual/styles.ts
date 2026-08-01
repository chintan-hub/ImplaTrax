import { StyleSheet } from '@react-pdf/renderer'

/**
 * Single source of truth for the manual's palette/type scale — kept
 * separate from the app's Tailwind tokens because @react-pdf/renderer has
 * its own StyleSheet system (no CSS variables, no Tailwind), and the manual
 * deliberately uses the exact obsidian/teal pairing from the login screen
 * rather than the app's day-to-day primary scale.
 */
export const COLORS = {
  obsidian: '#080B10',
  obsidianDeep: '#050709',
  teal: '#02C39A',
  tealDark: '#00A896',
  tealPale: '#E6FBF6',
  white: '#FFFFFF',
  slate900: '#0F172A',
  slate800: '#1E293B',
  slate700: '#334155',
  slate600: '#475569',
  slate500: '#64748B',
  slate400: '#94A3B8',
  slate300: '#CBD5E1',
  slate200: '#E2E8F0',
  slate100: '#F1F5F9',
  slate50: '#F8FAFC',
  amber500: '#F59E0B',
  amber700: '#92400E',
  amber50: '#FFFBEB',
  amber200: '#FDE68A',
  danger600: '#DC2626',
  danger50: '#FEF2F2',
  danger200: '#FECACA',
} as const

/** Standard PDF font — no network font registration, so the manual renders identically offline and never risks a broken font fetch. */
export const FONT = {
  regular: 'Helvetica',
  bold: 'Helvetica-Bold',
  oblique: 'Helvetica-Oblique',
} as const

export const PAGE_PADDING = { top: 64, bottom: 56, left: 56, right: 56 }

export const styles = StyleSheet.create({
  page: {
    fontFamily: FONT.regular,
    fontSize: 10.5,
    color: COLORS.slate800,
    paddingTop: PAGE_PADDING.top,
    paddingBottom: PAGE_PADDING.bottom,
    paddingLeft: PAGE_PADDING.left,
    paddingRight: PAGE_PADDING.right,
    backgroundColor: COLORS.white,
  },

  // Running header/footer — `fixed` Views repeat on every physically
  // generated page (including automatic pagination overflow pages), which
  // is what keeps the chapter title and accurate page count correct on
  // every page of a chapter that spans more than one physical sheet.
  runningHeader: {
    position: 'absolute',
    top: 24,
    left: PAGE_PADDING.left,
    right: PAGE_PADDING.right,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 0.75,
    borderBottomColor: COLORS.slate200,
    paddingBottom: 8,
  },
  runningHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  runningHeaderLogo: { width: 16, height: 16 },
  runningHeaderWordmark: { fontFamily: FONT.bold, fontSize: 8.5, color: COLORS.slate900, letterSpacing: 0.2 },
  runningHeaderTitle: { fontFamily: FONT.regular, fontSize: 8.5, color: COLORS.slate500 },

  runningFooter: {
    position: 'absolute',
    bottom: 24,
    left: PAGE_PADDING.left,
    right: PAGE_PADDING.right,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 0.75,
    borderTopColor: COLORS.slate200,
    paddingTop: 8,
  },
  footerLeft: { fontSize: 7.5, color: COLORS.slate400 },
  footerRight: { fontSize: 7.5, color: COLORS.slate400, fontFamily: FONT.bold },

  h1: { fontFamily: FONT.bold, fontSize: 20, color: COLORS.slate900, marginBottom: 4 },
  h2: { fontFamily: FONT.bold, fontSize: 13.5, color: COLORS.slate900, marginTop: 18, marginBottom: 8 },
  h3: { fontFamily: FONT.bold, fontSize: 11.5, color: COLORS.slate900, marginTop: 12, marginBottom: 6 },
  eyebrow: { fontFamily: FONT.bold, fontSize: 8, color: COLORS.tealDark, letterSpacing: 1.4, marginBottom: 6 },
  p: { fontSize: 10.5, lineHeight: 1.55, color: COLORS.slate700, marginBottom: 8 },
  small: { fontSize: 9, lineHeight: 1.5, color: COLORS.slate500 },
})
