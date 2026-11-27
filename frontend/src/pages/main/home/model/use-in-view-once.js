import { useEffect, useRef, useState } from 'react'

// Trả về [ref, inView]: inView bật true một lần khi phần tử vào viewport (mở rộng
// theo rootMargin). Phần tử đã nằm phía trên khung nhìn (tải lại giữa trang) cũng
// tính là đã tới, để khối phía trên không kẹt ở trạng thái chưa hiện.
export function useInViewOnce(threshold = 0.25, rootMargin = '0px') {
  const ref = useRef(null)
  const [inView, setInView] = useState(false)

  useEffect(() => {
    const node = ref.current
    if (!node || inView) return undefined
    if (!('IntersectionObserver' in window)) {
      setInView(true)
      return undefined
    }
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting || entry.boundingClientRect.bottom < 0) {
        setInView(true)
        observer.disconnect()
      }
    }, { threshold, rootMargin })
    observer.observe(node)
    return () => observer.disconnect()
  }, [inView, threshold, rootMargin])

  return [ref, inView]
}
