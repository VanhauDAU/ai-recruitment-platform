import { useEffect, useState } from 'react'

function measureBottomInset() {
  if (typeof window === 'undefined' || !window.visualViewport) return 0

  const viewport = window.visualViewport
  const layoutHeight = Math.max(
    window.innerHeight || 0,
    document.documentElement?.clientHeight || 0,
  )
  const visualBottom = (viewport.offsetTop || 0) + viewport.height

  return Math.max(0, Math.round(layoutHeight - visualBottom))
}

// Safari iPad neo `position: fixed` theo layout viewport. Khi thanh trình duyệt
// hiện lại lúc cuộn lên, visual viewport thấp hơn và có thể che các nút ở đáy.
export function useVisualViewportBottomInset() {
  const [bottomInset, setBottomInset] = useState(measureBottomInset)

  useEffect(() => {
    const viewport = window.visualViewport
    if (!viewport) return undefined

    let frameId = null
    const update = () => {
      frameId = null
      const nextInset = measureBottomInset()
      setBottomInset((current) => (current === nextInset ? current : nextInset))
    }
    const scheduleUpdate = () => {
      if (frameId !== null) return
      frameId = window.requestAnimationFrame(update)
    }

    scheduleUpdate()
    viewport.addEventListener('resize', scheduleUpdate)
    viewport.addEventListener('scroll', scheduleUpdate)
    window.addEventListener('resize', scheduleUpdate)

    return () => {
      if (frameId !== null) window.cancelAnimationFrame(frameId)
      viewport.removeEventListener('resize', scheduleUpdate)
      viewport.removeEventListener('scroll', scheduleUpdate)
      window.removeEventListener('resize', scheduleUpdate)
    }
  }, [])

  return bottomInset
}
