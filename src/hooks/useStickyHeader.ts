import { useEffect, useRef, useState } from 'react'

/**
 * Drives the shrink/blur transition on `<StickyActionHeader>`. Watches a
 * zero-height sentinel rendered immediately above the sticky header: once
 * the sentinel scrolls out of view, the header has reached its pinned
 * position and should switch to its compact state.
 *
 * Deliberately IntersectionObserver-based rather than a scroll listener —
 * the browser computes this off the main thread, so there's no per-frame
 * scroll handler to throttle/rAF and no risk of scroll jank, satisfying the
 * "no scroll lag" requirement by construction rather than by tuning.
 */
export function useStickyHeader() {
  const sentinelRef = useRef<HTMLDivElement>(null)
  const [isScrolled, setIsScrolled] = useState(false)

  useEffect(() => {
    const node = sentinelRef.current
    if (!node) return
    const observer = new IntersectionObserver(([entry]) => setIsScrolled(!entry.isIntersecting), { threshold: 0 })
    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  return { sentinelRef, isScrolled }
}
