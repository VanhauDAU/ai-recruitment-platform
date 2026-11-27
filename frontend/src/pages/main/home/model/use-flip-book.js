import { useEffect, useRef, useState } from 'react'
import { useMediaQuery } from '@/shared/hooks/use-media-query'
import { playSoundEffect } from '@/shared/lib/sound-player'

const AUTO_FLIP_MS = 5000
// Người dùng vừa chạm/vuốt/kéo thanh trang: đợi một lúc rồi mới tự lật lại.
const RESUME_AFTER_TOUCH_MS = 9000
const SWIPE_PX = 40
// Sách đóng: chỉ thấy bìa (trang 0) ở nửa phải, chưa có trang trái.
export const CLOSED = -1

/**
 * Trạng thái cuốn sách mẫu CV. `first` là trang trái đang mở: CLOSED khi sách đóng, sau đó
 * 1, 3, 5… (mỗi lần lật một lá, hai trang mới). `turning`: 'next' lật tới (từ bìa là mở
 * sách), 'prev' lật lùi (từ trang lót là gập về bìa), 'close' gập sách ở trang cuối để vòng
 * lại từ bìa. Lật xong (animationend của lá sách) mới đổi trang. Tự lật khi sách trong khung
 * nhìn, tab đang hiện, không bị tạm dừng và không bật giảm chuyển động (lúc đó đổi tức thì).
 * `count` là tổng số trang kể cả bìa, luôn lẻ (bìa + các cặp trang).
 */
export function useFlipBook(count) {
  const reducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)')
  const [first, setFirst] = useState(CLOSED)
  const [turning, setTurning] = useState(null)
  const [playing, setPlaying] = useState(true)
  const [held, setHeld] = useState(false)
  const bookRef = useRef(null)
  const resumeTimer = useRef(null)
  const swipe = useRef({ x: 0, moved: false })
  const canTurn = count > 1
  const lastSpread = count - 2

  const afterTurn = (kind) => (kind === 'next' ? first + 2 : kind === 'prev' ? first - 2 : CLOSED)

  // Tiếng lật giấy chỉ theo thao tác của người dùng (nút, vuốt): trình duyệt chặn âm thanh
  // chưa có thao tác, và tiếng lặp lại mỗi lần sách tự lật sẽ gây khó chịu.
  function turn(direction, { byUser = false } = {}) {
    if (!canTurn || turning) return
    if (direction === 'prev' && first === CLOSED) return
    const kind = direction === 'next' && first >= lastSpread ? 'close' : direction
    if (byUser) playSoundEffect('pageFlip')
    if (reducedMotion) setFirst(afterTurn(kind))
    else setTurning(kind)
  }

  function finishTurn() {
    setFirst(afterTurn(turning))
    setTurning(null)
  }

  // Thanh kéo: CLOSED hoặc trang trái của một lần mở (số lẻ).
  function goTo(index) {
    if (turning) return
    setFirst(index <= CLOSED ? CLOSED : Math.min(lastSpread, index - ((index + 1) % 2)))
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
    next: () => turn('next', { byUser: true }),
    prev: () => turn('prev', { byUser: true }),
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
        turn(dx < 0 ? 'next' : 'prev', { byUser: true })
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
