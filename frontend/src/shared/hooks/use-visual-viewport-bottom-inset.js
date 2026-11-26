import { useEffect, useState } from 'react'

// Bàn phím ảo đang mở khi một ô gõ chữ có focus: khung nhìn co lại và Safari cuộn
// nó theo con trỏ ở gần như mỗi phím. Khoảng hụt lúc đó là bàn phím, không phải
// thanh trình duyệt, nên giữ giá trị cũ thay vì vẽ lại cả cây mỗi phím gõ.
function isEditing() {
  const element = document.activeElement
  return Boolean(element && (element.isContentEditable || element.matches?.('input, textarea, select')))
}

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
      if (isEditing()) return
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
    // Rời ô gõ (bàn phím đóng) thì đo lại một lần.
    document.addEventListener('focusout', scheduleUpdate)

    return () => {
      if (frameId !== null) window.cancelAnimationFrame(frameId)
      viewport.removeEventListener('resize', scheduleUpdate)
      viewport.removeEventListener('scroll', scheduleUpdate)
      window.removeEventListener('resize', scheduleUpdate)
      document.removeEventListener('focusout', scheduleUpdate)
    }
  }, [])

  return bottomInset
}
