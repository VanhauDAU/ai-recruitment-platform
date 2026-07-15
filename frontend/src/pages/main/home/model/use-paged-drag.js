import { useEffect, useRef, useState } from 'react'

export function chunkItems(items, size) {
  return Array.from({ length: Math.ceil(items.length / size) }, (_, i) => items.slice(i * size, i * size + size))
}

// Carousel phân trang kéo được bằng pointer: quản lý page, drag offset và
// chặn click phát sinh ngay sau khi thả kéo.
export function usePagedDrag(totalPages) {
  const [page, setPage] = useState(0)
  const [dragOffset, setDragOffset] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const dragState = useRef({ active: false, startX: 0, width: 0, dragged: false, suppressClickUntil: 0 })
  const lastPage = Math.max(0, totalPages - 1)

  useEffect(() => {
    setPage((p) => Math.min(p, lastPage))
  }, [lastPage])

  function go(delta) {
    setPage((p) => Math.min(Math.max(p + delta, 0), lastPage))
  }

  function startDrag(e) {
    if (totalPages <= 1 || (e.button != null && e.button !== 0)) return
    dragState.current = {
      ...dragState.current,
      active: true,
      startX: e.clientX,
      width: e.currentTarget.clientWidth,
      dragged: false,
    }
    setIsDragging(true)
    e.currentTarget.setPointerCapture?.(e.pointerId)
  }

  function moveDrag(e) {
    if (!dragState.current.active) return
    const delta = e.clientX - dragState.current.startX
    if (Math.abs(delta) > 5) dragState.current.dragged = true
    const limit = Math.max(80, dragState.current.width * 0.35)
    setDragOffset(Math.min(Math.max(delta, -limit), limit))
  }

  function endDrag(e) {
    if (!dragState.current.active) return
    const delta = e.clientX - dragState.current.startX
    const threshold = Math.min(120, Math.max(56, dragState.current.width * 0.16))
    const dragged = dragState.current.dragged
    if (delta <= -threshold) go(1)
    if (delta >= threshold) go(-1)
    dragState.current = {
      ...dragState.current,
      active: false,
      dragged: false,
      suppressClickUntil: dragged ? Date.now() + 160 : 0,
    }
    setDragOffset(0)
    setIsDragging(false)
  }

  function cancelDrag() {
    if (!dragState.current.active) return
    dragState.current = { ...dragState.current, active: false, dragged: false }
    setDragOffset(0)
    setIsDragging(false)
  }

  function suppressClickAfterDrag(e) {
    if (Date.now() >= dragState.current.suppressClickUntil) return
    e.preventDefault()
    e.stopPropagation()
  }

  return {
    page,
    dragOffset,
    isDragging,
    canPrev: page > 0,
    canNext: page < lastPage,
    goPrev: () => go(-1),
    goNext: () => go(1),
    dragHandlers: {
      onPointerDown: startDrag,
      onPointerMove: moveDrag,
      onPointerUp: endDrag,
      onPointerCancel: cancelDrag,
      onClickCapture: suppressClickAfterDrag,
    },
  }
}
