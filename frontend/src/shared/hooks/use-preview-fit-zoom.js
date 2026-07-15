import { useEffect, useRef, useState } from 'react'

export function usePreviewFitZoom(enabled, pageWidth = 842) {
  const containerRef = useRef(null)
  const [zoom, setZoom] = useState(1)

  useEffect(() => {
    if (!enabled) return undefined
    const element = containerRef.current
    if (!element) return undefined
    const fit = () => setZoom(Math.min(1, element.clientWidth / pageWidth))
    fit()
    const observer = new ResizeObserver(fit)
    observer.observe(element)
    return () => observer.disconnect()
  }, [enabled, pageWidth])

  return { containerRef, zoom }
}
