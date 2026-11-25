import { useCallback, useEffect, useRef, useState } from 'react'

// Bề rộng trang CV ở mức 100% (khớp `usePreviewFitZoom`).
export const CV_PAGE_WIDTH = 842
const STEPS = [0.5, 0.67, 0.75, 0.9, 1, 1.1, 1.25, 1.5, 1.75, 2]
const MIN = STEPS[0]
const MAX = STEPS.at(-1)

/**
 * Mức thu phóng của khung xem CV. Mặc định vừa bề rộng khung (tối đa 100%);
 * người xem phóng to/thu nhỏ theo nấc, và mức đã chọn trở về mặc định khi đổi
 * sang CV khác (`resetKey`). Ctrl/⌘ + cuộn chuột (hoặc chụm trên touchpad) cũng
 * phóng to/thu nhỏ.
 */
export default function useCvZoom(enabled, resetKey) {
  const containerRef = useRef(null)
  const [fitZoom, setFitZoom] = useState(1)
  const [chosen, setChosen] = useState({ key: resetKey, zoom: null })
  const chosenZoom = chosen.key === resetKey ? chosen.zoom : null
  const zoom = chosenZoom ?? fitZoom

  useEffect(() => {
    const element = containerRef.current
    if (!enabled || !element) return undefined
    const fit = () => {
      const style = getComputedStyle(element)
      const width = element.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight)
      setFitZoom(Math.max(0.2, Math.min(1, width / CV_PAGE_WIDTH)))
    }
    fit()
    const observer = new ResizeObserver(fit)
    observer.observe(element)
    return () => observer.disconnect()
  }, [enabled])

  // `pick(value)` trả về mức mới từ mức hiện tại.
  const update = useCallback((pick) => {
    setChosen((current) => {
      const value = (current.key === resetKey ? current.zoom : null) ?? fitZoom
      return { key: resetKey, zoom: Math.min(MAX, Math.max(MIN, pick(value))) }
    })
  }, [fitZoom, resetKey])
  const step = (direction) => update((value) => (direction > 0
    ? STEPS.find((item) => item > value + 0.001) ?? MAX
    : STEPS.findLast((item) => item < value - 0.001) ?? MIN))

  useEffect(() => {
    const element = containerRef.current
    if (!enabled || !element) return undefined
    const onWheel = (event) => {
      if (!event.ctrlKey && !event.metaKey) return
      event.preventDefault()
      // Liên tục theo độ cuộn để chụm trên touchpad mượt, không nhảy nấc.
      update((value) => value * Math.exp(-event.deltaY / 300))
    }
    element.addEventListener('wheel', onWheel, { passive: false })
    return () => element.removeEventListener('wheel', onWheel)
  }, [enabled, update])

  return {
    containerRef,
    zoom,
    isFit: chosenZoom === null,
    canZoomIn: zoom < MAX - 0.001,
    canZoomOut: zoom > MIN + 0.001,
    zoomIn: () => step(1),
    zoomOut: () => step(-1),
    reset: () => setChosen({ key: resetKey, zoom: null }),
  }
}
