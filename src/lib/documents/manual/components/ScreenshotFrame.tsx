import { View, Text, Image, Svg, Rect, Circle, Path } from '@react-pdf/renderer'
import { COLORS, FONT } from '../styles'

interface Callout {
  number: number
  text: string
}

interface ScreenshotFrameProps {
  title: string
  caption?: string
  /** Once real screenshots exist, pass their resolved asset path/URL here — the frame renders it unchanged; everything else about the component (caption bar, callout legend, border/elevation) stays identical. */
  imageSrc?: string
  /** Aspect ratio (width / height) used to size the placeholder box before a real image is dropped in — matches the actual screenshot's shape so the layout doesn't jump later. */
  aspectRatio?: number
  callouts?: Callout[]
}

function PlaceholderGlyph() {
  return (
    <Svg width={30} height={30} viewBox="0 0 24 24">
      <Rect x={2.5} y={4.5} width={19} height={14} rx={1.5} stroke={COLORS.slate300} strokeWidth={1.4} fill="none" />
      <Circle cx={8} cy={9.5} r={1.4} stroke={COLORS.slate300} strokeWidth={1.2} fill="none" />
      <Path d="M4,16 L9,11 L13,14.5 L16,11.5 L20,15.5" stroke={COLORS.slate300} strokeWidth={1.4} fill="none" />
    </Svg>
  )
}

/**
 * The manual's "Screenshot Annotation Frame" — an elevated card with a
 * caption bar, the image (or a descriptive placeholder until a real
 * screenshot is dropped in), and a numbered callout legend for whatever
 * the annotations point at. Locked with wrap={false}: a screenshot
 * frame splitting across a page break would orphan its caption from its
 * image, which is worse than pushing the whole frame to the next page.
 */
export function ScreenshotFrame({ title, caption, imageSrc, aspectRatio = 16 / 9.6, callouts }: ScreenshotFrameProps) {
  const width = 470
  const height = width / aspectRatio
  return (
    <View wrap={false} style={{ marginVertical: 12, width, borderWidth: 1, borderColor: COLORS.slate200, borderRadius: 6, backgroundColor: COLORS.white }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingVertical: 6,
          paddingHorizontal: 10,
          borderBottomWidth: 1,
          borderBottomColor: COLORS.slate200,
          backgroundColor: COLORS.slate50,
        }}
      >
        <View style={{ flexDirection: 'row', gap: 4, marginRight: 8 }}>
          <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: COLORS.slate300 }} />
          <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: COLORS.slate300 }} />
          <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: COLORS.slate300 }} />
        </View>
        <Text style={{ fontSize: 8.5, fontFamily: FONT.bold, color: COLORS.slate600 }}>{title}</Text>
      </View>

      {imageSrc ? (
        <Image src={imageSrc} style={{ width: '100%', height, objectFit: 'contain', borderRadius: 6 }} />
      ) : (
        <View style={{ width: '100%', height, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.slate100, gap: 6 }}>
          <PlaceholderGlyph />
          <Text style={{ fontSize: 8.5, color: COLORS.slate400, fontFamily: FONT.bold }}>SCREENSHOT PLACEHOLDER</Text>
          <Text style={{ fontSize: 8, color: COLORS.slate400, maxWidth: 320, textAlign: 'center' }}>{title}</Text>
        </View>
      )}

      {(caption || callouts) && (
        <View style={{ padding: 10, borderTopWidth: 1, borderTopColor: COLORS.slate200 }}>
          {caption && <Text style={{ fontSize: 9, color: COLORS.slate500, lineHeight: 1.45, marginBottom: callouts ? 6 : 0 }}>{caption}</Text>}
          {callouts?.map((c) => (
            <View key={c.number} style={{ flexDirection: 'row', marginBottom: 3 }}>
              <View style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: COLORS.teal, alignItems: 'center', justifyContent: 'center', marginRight: 6, marginTop: 0.5 }}>
                <Text style={{ fontSize: 7.5, fontFamily: FONT.bold, color: COLORS.white }}>{c.number}</Text>
              </View>
              <Text style={{ fontSize: 9, color: COLORS.slate600, flex: 1, lineHeight: 1.4 }}>{c.text}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  )
}
