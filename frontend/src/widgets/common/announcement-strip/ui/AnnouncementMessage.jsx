import { useEffect, useLayoutEffect, useRef, useState } from 'react'

const MARQUEE_PX_PER_SECOND = 40

/**
 * Thông báo luôn một dòng; câu dài hơn khung thì chạy chữ (dừng ở đầu/cuối để đọc).
 * Báo lên thời lượng một lượt chạy để dải không chuyển thông báo giữa chừng.
 */
export default function AnnouncementMessage({ text, onDuration }) {
  const boxRef = useRef(null)
  const textRef = useRef(null)
  const [distance, setDistance] = useState(0)
  useLayoutEffect(() => {
    const measure = () => setDistance(
      Math.max(0, Math.ceil(textRef.current.offsetWidth - boxRef.current.clientWidth)),
    )
    measure()
    if (typeof ResizeObserver === 'undefined') return undefined
    const observer = new ResizeObserver(measure)
    observer.observe(boxRef.current)
    return () => observer.disconnect()
  }, [text])
  // 70% thời lượng để chạy, 15% dừng mỗi đầu (keyframes announcement-marquee).
  const seconds = distance ? Math.max(4, Math.ceil(distance / MARQUEE_PX_PER_SECOND / 0.7)) : 0
  useEffect(() => onDuration(seconds), [onDuration, seconds])
  return (
    <span
      ref={boxRef}
      className="announcement-strip__message"
      data-marquee={distance ? 'true' : undefined}
      style={distance ? {
        '--announcement-marquee-distance': `-${distance}px`,
        '--announcement-marquee-duration': `${seconds}s`,
      } : undefined}
    >
      <span ref={textRef} className="announcement-strip__marquee">{text}</span>
    </span>
  )
}
