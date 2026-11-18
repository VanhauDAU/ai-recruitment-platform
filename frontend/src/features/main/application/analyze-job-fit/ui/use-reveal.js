import { useEffect, useState } from 'react'

const prefersReducedMotion = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

// Số đếm từ 0 tới `target` trong `duration` ms (một lần khi kết quả hiện ra).
// Người dùng bật "giảm chuyển động" thì hiện ngay giá trị cuối.
export function useCountUp(target, duration = 900) {
  const [value, setValue] = useState(() => (prefersReducedMotion() ? target : 0))
  useEffect(() => {
    if (prefersReducedMotion()) {
      setValue(target)
      return undefined
    }
    let frame
    const start = performance.now()
    const tick = (now) => {
      const progress = Math.min((now - start) / duration, 1)
      setValue(Math.round(target * (1 - (1 - progress) ** 3)))
      if (progress < 1) frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [target, duration])
  return value
}

// false ở lần vẽ đầu, true ngay sau đó: để CSS transition chạy từ trạng thái rỗng.
export function useRevealed() {
  const [revealed, setRevealed] = useState(false)
  useEffect(() => {
    const frame = requestAnimationFrame(() => setRevealed(true))
    return () => cancelAnimationFrame(frame)
  }, [])
  return revealed
}
