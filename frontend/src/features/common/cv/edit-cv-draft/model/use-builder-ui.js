import { useState } from 'react'

const A4_WIDTH_PX = 794 // 210mm ở 96 dpi
const CANVAS_GUTTER_PX = 32 // px-4 hai bên của vùng canvas

/**
 * Mức zoom để trang A4 vừa khít bề ngang: desktop cố định 80%, màn hẹp tính theo
 * cửa sổ (48% cũ làm trang tràn mép phải trên điện thoại 390px).
 */
export function fitZoom(isDesktop) {
  if (isDesktop) return 0.8
  const width = globalThis.innerWidth || 390
  return Math.max(0.3, Math.min(0.8, Math.floor(((width - CANVAS_GUTTER_PX) / A4_WIDTH_PX) * 100) / 100))
}

export function useBuilderUi(initialZoom = 0.8) {
  const [activeTool, setActiveTool] = useState('design')
  const [zoom, setZoom] = useState(initialZoom)
  return {
    activeTool,
    setActiveTool,
    zoom,
    zoomIn: () => setZoom((value) => Math.min(1.25, Number((value + 0.1).toFixed(2)))),
    zoomOut: () => setZoom((value) => Math.max(0.3, Number((value - 0.1).toFixed(2)))),
    fit: (value = 0.8) => setZoom(value),
  }
}
