import { useEffect, useRef } from 'react'

/**
 * Call `onEnter` when the element in `targetRef` scrolls into view (inside
 * `rootRef` when given). Toggling `enabled` re-arms it, so a sentinel that is
 * still visible after a page loads fires again (infinite lists).
 */
export function useIntersection(targetRef, onEnter, { rootRef, enabled = true, rootMargin = '160px' } = {}) {
  const latest = useRef(onEnter)
  useEffect(() => {
    latest.current = onEnter
  })
  useEffect(() => {
    const target = targetRef.current
    if (!enabled || !target || typeof IntersectionObserver === 'undefined') return undefined
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) latest.current()
      },
      { root: rootRef?.current || null, rootMargin },
    )
    observer.observe(target)
    return () => observer.disconnect()
  }, [enabled, rootMargin, rootRef, targetRef])
}
