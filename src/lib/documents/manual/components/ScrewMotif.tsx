import { Svg, Path, Polygon, Line } from '@react-pdf/renderer'

interface ScrewMotifProps {
  width?: number
  height?: number
  /** Stroke color for the wireframe outline + thread lines. */
  color?: string
  /** Opacity of the whole motif — low (0.08–0.18) when used as a page watermark, higher (0.6–1) as a standalone illustration. */
  opacity?: number
  strokeWidth?: number
}

const VB_W = 120
const VB_H = 300

/** Piecewise outline, in viewBox units: hex head -> stepped shoulder -> tapered threaded shaft -> pointed tip. Mirrors the same silhouette used by the login screen's CAD mesh and the ImplaTrax wordmark's "I" glyph, redrawn as a clean wireframe for print. */
const HEAD_HEX = '28,10 92,10 110,30 92,50 28,50 10,30'
const HEAD_RECESS = '46,20 74,20 84,30 74,40 46,40 36,30'
const SHOULDER = '28,50 92,50 78,75 42,75'
const SHAFT_OUTLINE = 'M42,75 L78,75 L70,258 L60,290 L50,258 Z'

function threadLines() {
  const lines: { x1: number; y1: number; x2: number; y2: number }[] = []
  const top = 88
  const bottom = 250
  const count = 9
  for (let i = 0; i < count; i++) {
    const t = i / (count - 1)
    const y = top + t * (bottom - top)
    // Shaft tapers linearly from (42,75)-(78,75) to (50,258)-(70,258) — interpolate the thread's left/right x at this y so every crest line hugs the outline.
    const leftAt = 42 + (50 - 42) * ((y - 75) / (258 - 75))
    const rightAt = 78 + (70 - 78) * ((y - 75) / (258 - 75))
    lines.push({ x1: leftAt + 2, y1: y, x2: rightAt - 2, y2: y + 9 })
  }
  return lines
}

/**
 * The manual's signature CAD motif — a stroked wireframe implant screw
 * (hex-drive head, stepped shoulder, tapered V-threaded shaft, pointed
 * tip), used on the cover, chapter dividers, and as a faint page
 * watermark. Pure vector paths, so it stays crisp and searchable-adjacent
 * (it never touches the text layer) at any print size.
 */
export function ScrewMotif({ width = 160, height, color = '#02C39A', opacity = 1, strokeWidth = 1.5 }: ScrewMotifProps) {
  const h = height ?? (width * VB_H) / VB_W
  return (
    <Svg width={width} height={h} viewBox={`0 0 ${VB_W} ${VB_H}`} style={{ opacity }}>
      <Polygon points={HEAD_HEX} stroke={color} strokeWidth={strokeWidth} fill="none" />
      <Polygon points={HEAD_RECESS} stroke={color} strokeWidth={strokeWidth * 0.75} fill="none" />
      <Polygon points={SHOULDER} stroke={color} strokeWidth={strokeWidth} fill="none" />
      <Path d={SHAFT_OUTLINE} stroke={color} strokeWidth={strokeWidth} fill="none" />
      {threadLines().map((l, i) => (
        <Line key={i} x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2} stroke={color} strokeWidth={strokeWidth * 0.7} />
      ))}
      {/* longitude construction lines — the faint blueprint touch */}
      <Line x1={60} y1={12} x2={60} y2={288} stroke={color} strokeWidth={0.4} strokeDasharray="2,3" opacity={0.5} />
    </Svg>
  )
}
