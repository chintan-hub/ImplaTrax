import { useEffect, useRef } from 'react'

interface ImplantMeshCanvasProps {
  className?: string
  /** Freezes rotation/parallax and respects the user's OS-level motion preference. */
  reducedMotion?: boolean
}

/**
 * A precision CAD-style wireframe of a dental implant screw, drawn entirely
 * with the 2D Canvas API — no Three.js/WebGL dependency for what is, at
 * bottom, a few hundred projected line segments. The geometry (thread
 * helix, tapered body, hex-drive head) is generated once; every frame just
 * rotates and re-projects it, so the "3D" is real (a rotation + perspective
 * divide), not a pre-rendered sprite.
 *
 * Two visual layers read as one object: a longitude/latitude wireframe grid
 * (the "architectural CAD" cue) and a sparse scatter of glowing nodes at
 * grid intersections (the "plexus" cue) — depth-sorted so nearer lines/
 * nodes draw brighter and farther ones fade, the only cue this projection
 * needs to read as solid rather than flat.
 */
export function ImplantMeshCanvas({ className, reducedMotion = false }: ImplantMeshCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const pointerTarget = useRef({ x: 0, y: 0 })
  const pointerCurrent = useRef({ x: 0, y: 0 })

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const maybeCtx = canvas.getContext('2d')
    if (!maybeCtx) return
    // Re-typed as non-null: TS control-flow narrowing on `maybeCtx` doesn't
    // propagate into the nested `draw` closure below, since it's only
    // invoked later via requestAnimationFrame — this const's declared type
    // is what closures actually see.
    const ctx: CanvasRenderingContext2D = maybeCtx

    // ------------------------------------------------------------------
    // Geometry — built once. Model space: y spans [-1, 1] (tip to head),
    // radius spans roughly [0, 0.5]. t is the 0..1 position along that axis.
    //
    // Piecewise, not a smooth taper end-to-end — a continuous cone reads as
    // a tornado/funnel, not a screw. What actually sells "implant screw" is
    // a short pointed tip, a long near-cylindrical threaded shaft, a sharp
    // step up to a flat collar, and a short flat hex-drive head — the same
    // silhouette landmarks a real fixture has.
    // ------------------------------------------------------------------
    const RING_COUNT = 60
    const RING_STEP = 1 // draw every ring — the thread relief needs the density to read
    const SEG_COUNT = 26
    const SEG_STEP = 3 // every 3rd angular position drawn as a longitude rib
    const THREAD_TURNS = 13
    const THREAD_AMP = 0.052
    const TIP_END = 0.09
    const SHOULDER_START = 0.78
    const SHOULDER_END = 0.83
    const CORE_RADIUS = 0.27
    const COLLAR_RADIUS = 0.44

    function bodyRadius(t: number) {
      if (t < TIP_END) return (t / TIP_END) * CORE_RADIUS // sharp pointed tip
      if (t < SHOULDER_START) return CORE_RADIUS // long cylindrical threaded shaft
      if (t < SHOULDER_END) {
        const local = (t - SHOULDER_START) / (SHOULDER_END - SHOULDER_START)
        return CORE_RADIUS + local * (COLLAR_RADIUS - CORE_RADIUS) // sharp step up to the collar
      }
      return COLLAR_RADIUS // flat hex-drive head
    }

    // Asymmetric sawtooth (not a smooth cosine) — a real V-thread's cross
    // section is a sharp ridge, not a gentle wave, and it reads as
    // unmistakably "threaded" at a glance rather than just "wavy".
    function threadWave(phase: number) {
      const p = ((phase % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)
      const u = p / (Math.PI * 2) // 0..1
      return u < 0.35 ? u / 0.35 : 1 - (u - 0.35) / 0.65 // fast rise, slow fall
    }

    function radiusAt(t: number, angle: number) {
      const base = bodyRadius(t)
      if (t < TIP_END || t >= SHOULDER_START) return base
      return base + THREAD_AMP * (threadWave(angle - t * THREAD_TURNS * Math.PI * 2) - 0.5)
    }

    interface Node3D { x: number; y: number; z: number }

    const rings: Node3D[][] = []
    for (let r = 0; r <= RING_COUNT; r++) {
      const t = r / RING_COUNT
      const y = -1 + t * 2
      const ring: Node3D[] = []
      for (let s = 0; s < SEG_COUNT; s++) {
        const angle = (s / SEG_COUNT) * Math.PI * 2
        const rad = radiusAt(t, angle)
        ring.push({ x: Math.cos(angle) * rad, y, z: Math.sin(angle) * rad })
      }
      rings.push(ring)
    }

    // Three continuous helix crest-lines wound around the shaft — the
    // unmistakable "screw thread" signature a grid of rings alone doesn't
    // fully sell on its own. Traces the thread's outer (major-diameter) crest.
    const helixLines: Node3D[][] = [0, 1, 2].map((k) => {
      const phase = (k / 3) * Math.PI * 2
      const pts: Node3D[] = []
      const STEPS = 140
      for (let i = 0; i <= STEPS; i++) {
        const t = TIP_END + (i / STEPS) * (SHOULDER_START - TIP_END)
        const angle = phase + t * THREAD_TURNS * Math.PI * 2
        const rad = CORE_RADIUS + THREAD_AMP * 0.5
        pts.push({ x: Math.cos(angle) * rad, y: -1 + t * 2, z: Math.sin(angle) * rad })
      }
      return pts
    })

    // Hex-drive recess on the top face, plus spokes out to the collar rim.
    const hexPoints: Node3D[] = Array.from({ length: 6 }, (_, i) => {
      const angle = (i / 6) * Math.PI * 2
      return { x: Math.cos(angle) * (COLLAR_RADIUS * 0.42), y: 0.995, z: Math.sin(angle) * (COLLAR_RADIUS * 0.42) }
    })
    const rimPoints: Node3D[] = Array.from({ length: 8 }, (_, i) => {
      const angle = (i / 8) * Math.PI * 2
      return { x: Math.cos(angle) * COLLAR_RADIUS, y: 0.995, z: Math.sin(angle) * COLLAR_RADIUS }
    })

    // Glow nodes: a sparse, deterministic sample of ring/segment intersections.
    const glowNodes: Node3D[] = []
    for (let r = 0; r <= RING_COUNT; r += 5) {
      for (let s = 0; s < SEG_COUNT; s += SEG_STEP * 2) {
        glowNodes.push(rings[r][s])
      }
    }

    // ------------------------------------------------------------------
    // Render loop
    // ------------------------------------------------------------------
    let raf = 0
    let autoYaw = 0.35
    let pitch = 0
    let yawOffset = 0
    let lastT = performance.now()
    let dpr = Math.min(window.devicePixelRatio || 1, 2)

    function resize() {
      if (!canvas) return
      const rect = canvas.parentElement?.getBoundingClientRect()
      const w = rect?.width ?? canvas.clientWidth
      const h = rect?.height ?? canvas.clientHeight
      dpr = Math.min(window.devicePixelRatio || 1, 2)
      canvas.width = Math.max(1, Math.round(w * dpr))
      canvas.height = Math.max(1, Math.round(h * dpr))
      canvas.style.width = `${w}px`
      canvas.style.height = `${h}px`
    }
    resize()
    const resizeObserver = new ResizeObserver(resize)
    if (canvas.parentElement) resizeObserver.observe(canvas.parentElement)

    function project(p: Node3D, cosY: number, sinY: number, cosX: number, sinX: number, dist: number, scale: number, cx: number, cy: number) {
      const x1 = p.x * cosY - p.z * sinY
      const z1 = p.x * sinY + p.z * cosY
      const y1 = p.y * cosX - z1 * sinX
      const z2 = p.y * sinX + z1 * cosX
      const persp = dist / (dist - z2)
      return { x: cx + x1 * persp * scale, y: cy - y1 * persp * scale, depth: z2 }
    }

    function depthAlpha(z: number) {
      return Math.max(0.12, Math.min(1, (z + 1.1) / 2.1))
    }

    function draw(now: number) {
      if (!canvas) return
      const dt = Math.min(0.05, (now - lastT) / 1000)
      lastT = now

      if (!reducedMotion) {
        autoYaw += dt * 0.28
        pitch += (pointerCurrent.current.y - pitch) * Math.min(1, dt * 4)
        yawOffset += (pointerCurrent.current.x - yawOffset) * Math.min(1, dt * 4)
        pointerCurrent.current.x += (pointerTarget.current.x - pointerCurrent.current.x) * Math.min(1, dt * 3)
        pointerCurrent.current.y += (pointerTarget.current.y - pointerCurrent.current.y) * Math.min(1, dt * 3)
      }

      const w = canvas.width / dpr
      const h = canvas.height / dpr
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, w, h)

      const cx = w / 2
      const cy = h / 2
      const scale = Math.min(w, h) * 0.62
      const dist = 3.4
      const yaw = autoYaw + yawOffset * 0.35
      const tilt = 0.18 + pitch * 0.22
      const cosY = Math.cos(yaw), sinY = Math.sin(yaw)
      const cosX = Math.cos(tilt), sinX = Math.sin(tilt)

      const proj = (p: Node3D) => project(p, cosY, sinY, cosX, sinX, dist, scale, cx, cy)

      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'

      // Latitude rings
      for (let r = 0; r <= RING_COUNT; r += RING_STEP) {
        const ring = rings[r]
        ctx.beginPath()
        for (let s = 0; s <= SEG_COUNT; s++) {
          const p = proj(ring[s % SEG_COUNT])
          if (s === 0) ctx.moveTo(p.x, p.y)
          else ctx.lineTo(p.x, p.y)
        }
        const midDepth = proj(ring[0]).depth
        ctx.strokeStyle = `rgba(45, 212, 191, ${0.1 * depthAlpha(midDepth)})`
        ctx.lineWidth = 1
        ctx.stroke()
      }

      // Longitude ribs
      for (let s = 0; s < SEG_COUNT; s += SEG_STEP) {
        ctx.beginPath()
        for (let r = 0; r <= RING_COUNT; r++) {
          const p = proj(rings[r][s])
          if (r === 0) ctx.moveTo(p.x, p.y)
          else ctx.lineTo(p.x, p.y)
        }
        const midDepth = proj(rings[Math.floor(RING_COUNT / 2)][s]).depth
        ctx.strokeStyle = `rgba(45, 212, 191, ${0.16 * depthAlpha(midDepth)})`
        ctx.lineWidth = 1
        ctx.stroke()
      }

      // Thread helix lines — the brightest structural lines, the screw's signature.
      for (const line of helixLines) {
        ctx.beginPath()
        for (let i = 0; i < line.length; i++) {
          const p = proj(line[i])
          if (i === 0) ctx.moveTo(p.x, p.y)
          else ctx.lineTo(p.x, p.y)
        }
        const midDepth = proj(line[Math.floor(line.length / 2)]).depth
        ctx.strokeStyle = `rgba(94, 234, 212, ${0.7 * depthAlpha(midDepth)})`
        ctx.lineWidth = 1.5
        ctx.stroke()
      }

      // Hex-drive recess + rim spokes
      ctx.beginPath()
      hexPoints.forEach((hp, i) => {
        const p = proj(hp)
        if (i === 0) ctx.moveTo(p.x, p.y)
        else ctx.lineTo(p.x, p.y)
      })
      ctx.closePath()
      ctx.strokeStyle = 'rgba(153, 246, 228, 0.5)'
      ctx.lineWidth = 1.2
      ctx.stroke()
      for (let i = 0; i < rimPoints.length; i++) {
        const a = proj(rimPoints[i])
        const b = proj(hexPoints[i % hexPoints.length])
        ctx.beginPath()
        ctx.moveTo(a.x, a.y)
        ctx.lineTo(b.x, b.y)
        ctx.strokeStyle = `rgba(45, 212, 191, ${0.18 * depthAlpha(a.depth)})`
        ctx.lineWidth = 1
        ctx.stroke()
      }

      // Plexus glow nodes
      for (const node of glowNodes) {
        const p = proj(node)
        const a = depthAlpha(p.depth)
        const r = 1.1 + a * 1.6
        ctx.beginPath()
        ctx.arc(p.x, p.y, r * 2.6, 0, Math.PI * 2)
        const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r * 2.6)
        grad.addColorStop(0, `rgba(94, 234, 212, ${0.5 * a})`)
        grad.addColorStop(1, 'rgba(94, 234, 212, 0)')
        ctx.fillStyle = grad
        ctx.fill()
        ctx.beginPath()
        ctx.arc(p.x, p.y, r, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(204, 251, 241, ${0.85 * a})`
        ctx.fill()
      }

      raf = requestAnimationFrame(draw)
    }

    raf = requestAnimationFrame(draw)

    const handlePointerMove = (e: PointerEvent) => {
      pointerTarget.current.x = (e.clientX / window.innerWidth) * 2 - 1
      pointerTarget.current.y = (e.clientY / window.innerHeight) * 2 - 1
    }
    const resetPointer = () => {
      pointerTarget.current.x = 0
      pointerTarget.current.y = 0
    }
    if (!reducedMotion) {
      window.addEventListener('pointermove', handlePointerMove)
      window.addEventListener('pointerleave', resetPointer)
    }

    return () => {
      cancelAnimationFrame(raf)
      resizeObserver.disconnect()
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerleave', resetPointer)
    }
  }, [reducedMotion])

  return <canvas ref={canvasRef} className={className} />
}
