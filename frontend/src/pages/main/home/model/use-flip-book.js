import { useEffect, useRef, useState } from 'react'
import { useMediaQuery } from '@/shared/hooks/use-media-query'

const AUTO_FLIP_MS = 5000
// Người dùng vừa chạm/vuốt/kéo thanh trang: đợi một lúc rồi mới tự lật lại.
const RESUME_AFTER_TOUCH_MS = 9000
const SWIPE_PX = 40
// Sách luôn mở hai trang, mỗi lần lật một lá (hai trang mới).
const STEP = 2

export const wrapPage = (index, count) => ((index % count) + count) % count

/**
 * Trạng thái cuốn sách mẫu CV: `first` là trang trái đang mở (số chẵn), `turning` là chiều
 * đang lật. Mọi cỡ màn hình cùng một cuốn sách mở hai trang. Lật xong
 * (animationend của lá sách) mới đổi trang. Tự lật khi sách trong khung nhìn, tab đang
 * hiện, không bị tạm dừng và không bật giảm chuyển động (lúc đó lật tức thì, không hiệu ứng).
 */
export function useFlipBook(count) {
  const reducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)')
  const [page, setPage] = useState(0)
  const [turning, setTurning] = useState(null)
  const [playing, setPlaying] = useState(true)
  const [held, setHeld] = useState(false)
  const bookRef = useRef(null)
  const resumeTimer = useRef(null)
  const swipe = useRef({ x: 0, moved: false })
  const first = count ? wrapPage(page - (page % STEP), count) : 0
  const canTurn = count > STEP

  function turn(direction) {
    if (!canTurn || turning) return
    if (reducedMotion) setPage(wrapPage(first + (direction === 'next' ? STEP : -STEP), count))
    else setTurning(direction)
  }

  function finishTurn() {
    setPage(wrapPage(first + (turning === 'next' ? STEP : -STEP), count))
    setTurning(null)
  }

  function goTo(index) {
    if (turning) return
    setPage(wrapPage(index, count))
  }

  function holdAfterTouch() {
    setHeld(true)
    clearTimeout(resumeTimer.current)
    resumeTimer.current = setTimeout(() => setHeld(false), RESUME_AFTER_TOUCH_MS)
  }

  // Interval đọc hàm lật mới nhất qua ref để không phải dựng lại mỗi lần đổi trang.
  const turnRef = useRef(turn)
  useEffect(() => {
    turnRef.current = turn
  })

  useEffect(() => {
    const book = bookRef.current
    if (!canTurn || !playing || held || reducedMotion || !book || !('IntersectionObserver' in window)) return undefined
    let visible = false
    const observer = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting }, { threshold: 0.5 })
    observer.observe(book)
    const timer = setInterval(() => {
      if (visible && !document.hidden) turnRef.current('next')
    }, AUTO_FLIP_MS)
    return () => {
      clearInterval(timer)
      observer.disconnect()
    }
  }, [canTurn, playing, held, reducedMotion])

  useEffect(() => () => clearTimeout(resumeTimer.current), [])

  return {
    bookRef,
    first,
    turning,
    playing,
    canTurn,
    next: () => turn('next'),
    prev: () => turn('prev'),
    goTo,
    finishTurn,
    togglePlaying: () => setPlaying((value) => !value),
    holdAfterTouch,
    bookProps: {
      // Chỉ chuột mới "rê": chạm trên điện thoại không có mouseleave nên sẽ kẹt dừng mãi.
      onPointerEnter: (event) => event.pointerType === 'mouse' && setHeld(true),
      onPointerLeave: (event) => event.pointerType === 'mouse' && setHeld(false),
      onPointerDown: (event) => {
        swipe.current = { x: event.clientX, moved: false }
      },
      onPointerUp: (event) => {
        const dx = event.clientX - swipe.current.x
        if (Math.abs(dx) < SWIPE_PX) return
        swipe.current.moved = true
        holdAfterTouch()
        turn(dx < 0 ? 'next' : 'prev')
      },
      // Vuốt trên một trang mẫu (là link) không được mở trang chi tiết.
      onClickCapture: (event) => {
        if (!swipe.current.moved) return
        swipe.current.moved = false
        event.preventDefault()
        event.stopPropagation()
      },
    },
  }
}
