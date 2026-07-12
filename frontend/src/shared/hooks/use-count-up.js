import { useEffect, useRef, useState } from 'react'

// Counts from 0 up to `value` (ease-out cubic) whenever it changes.
// Pass { enabled: false } to hold at 0 until it should play (e.g. on scroll into view).
export function useCountUp(value, { enabled = true, duration = 900 } = {}) {
  const [display, setDisplay] = useState(0)
  const raf = useRef(null)

  useEffect(() => {
    if (!enabled || value == null) return undefined
    const target = Number(value) || 0
    const start = performance.now()
    const tick = (now) => {
      const progress = Math.min(1, (now - start) / duration)
      setDisplay(Math.round(target * (1 - (1 - progress) ** 3)))
      if (progress < 1) raf.current = requestAnimationFrame(tick)
    }
    raf.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf.current)
  }, [value, enabled, duration])

  return display
}
