import { useState } from 'react'

export function useBuilderUi(initialZoom = 0.8) {
  const [activeTool, setActiveTool] = useState('design')
  const [zoom, setZoom] = useState(initialZoom)
  return {
    activeTool,
    setActiveTool,
    zoom,
    zoomIn: () => setZoom((value) => Math.min(1.25, Number((value + 0.1).toFixed(2)))),
    zoomOut: () => setZoom((value) => Math.max(0.4, Number((value - 0.1).toFixed(2)))),
    fit: (value = 0.8) => setZoom(value),
  }
}
