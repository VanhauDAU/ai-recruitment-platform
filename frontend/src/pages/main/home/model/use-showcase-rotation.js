import { useEffect, useRef, useState } from 'react'
import { useMediaQuery } from '@/shared/hooks/use-media-query'

const ROTATE_MS = 3600
// Người dùng vừa chạm/vuốt dãy thẻ: đợi một lúc rồi mới tự chạy lại.
const RESUME_AFTER_TOUCH_MS = 8000

function scrollDeckTo(deck, index, behavior = 'smooth') {
  const card = deck?.children[index]
  if (!card) return
  deck.scrollTo({ left: card.offsetLeft - (deck.clientWidth - card.offsetWidth) / 2, behavior })
}

/**
 * Thẻ mẫu CV trang chủ tự luân phiên. Desktop (lg): đổi `center`, CSS đưa thẻ qua các
 * vị trí 3D. Dưới lg: cuộn dãy snap tới thẻ kế tiếp, sự kiện scroll cập nhật `center`.
 * Chỉ chạy khi khối đang trong khung nhìn, tab đang hiện và không bật giảm chuyển động.
 */
export function useShowcaseRotation(count) {
  const wide = useMediaQuery('(min-width: 1024px)')
  const reducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)')
  const deckRef = useRef(null)
  // null = chưa ai chọn: thẻ giữa ở tâm để hai thẻ bên ló ra.
  const [chosen, setCenter] = useState(null)
  const center = chosen ?? Math.floor(count / 2)
  const centerRef = useRef(center)
  const [paused, setPaused] = useState(false)
  const resumeTimer = useRef(null)

  useEffect(() => {
    centerRef.current = center
  }, [center])

  function goTo(index) {
    if (wide) setCenter(index)
    else scrollDeckTo(deckRef.current, index)
  }

  function trackScroll() {
    const deck = deckRef.current
    if (!deck || wide) return
    const middle = deck.scrollLeft + deck.clientWidth / 2
    const nearest = [...deck.children].reduce((best, card, index) => {
      const distance = Math.abs(card.offsetLeft + card.offsetWidth / 2 - middle)
      return distance < best.distance ? { index, distance } : best
    }, { index: 0, distance: Infinity })
    setCenter(nearest.index)
  }

  function pauseAfterTouch() {
    setPaused(true)
    clearTimeout(resumeTimer.current)
    resumeTimer.current = setTimeout(() => setPaused(false), RESUME_AFTER_TOUCH_MS)
  }

  // Dưới lg đưa thẻ đang chọn vào tâm dãy cuộn khi thẻ vừa tải hoặc đổi cỡ màn hình.
  useEffect(() => {
    if (count > 1 && !wide) scrollDeckTo(deckRef.current, centerRef.current, 'instant')
  }, [count, wide])

  useEffect(() => {
    const deck = deckRef.current
    if (count < 2 || paused || reducedMotion || !deck || !('IntersectionObserver' in window)) return undefined
    let visible = false
    const observer = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting }, { threshold: 0.4 })
    observer.observe(deck)
    const timer = setInterval(() => {
      if (!visible || document.hidden) return
      const next = (centerRef.current + 1) % count
      if (wide) setCenter(next)
      else scrollDeckTo(deck, next)
    }, ROTATE_MS)
    return () => {
      clearInterval(timer)
      observer.disconnect()
    }
  }, [count, paused, reducedMotion, wide])

  useEffect(() => () => clearTimeout(resumeTimer.current), [])

  return {
    center,
    deckRef,
    goTo,
    deckProps: {
      onScroll: trackScroll,
      onPointerDown: wide ? undefined : pauseAfterTouch,
      onMouseEnter: wide ? () => setPaused(true) : undefined,
      onMouseLeave: wide ? () => setPaused(false) : undefined,
      onFocus: () => setPaused(true),
      onBlur: () => setPaused(false),
    },
  }
}

/** Vị trí 3D của thẻ `index` khi thẻ `center` ở giữa (desktop). */
export function showcaseSlot(index, center, count) {
  if (count < 2) return 'center'
  const offset = (index - center + count) % count
  if (offset === 0) return 'center'
  return offset === 1 ? 'right' : 'left'
}
