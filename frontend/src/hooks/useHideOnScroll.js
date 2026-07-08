import { useEffect, useState } from 'react'

// Ẩn thanh (header) khi cuộn xuống, hiện lại khi cuộn lên hoặc ở gần đỉnh trang.
// Trả về true = nên hiển thị. `threshold` = khoảng cách tối thiểu từ đỉnh trước khi bắt đầu ẩn.
export function useHideOnScroll(threshold = 96) {
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    let last = window.scrollY
    let ticking = false

    function evaluate() {
      const y = window.scrollY
      if (y < threshold) setVisible(true)
      else if (y > last + 6) setVisible(false) // cuộn xuống rõ rệt -> ẩn
      else if (y < last - 6) setVisible(true) // cuộn lên rõ rệt -> hiện
      last = y
      ticking = false
    }

    function onScroll() {
      if (!ticking) {
        ticking = true
        requestAnimationFrame(evaluate)
      }
    }

    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [threshold])

  return visible
}
