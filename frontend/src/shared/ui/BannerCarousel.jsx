import { LeftOutlined, RightOutlined } from '@ant-design/icons'
import { useEffect, useRef, useState } from 'react'
import { m } from '@/shared/config/i18n'

const AUTO_SLIDE_MS = 5000
const SWIPE_MIN_PX = 40

function prefersReducedMotion() {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
}

/**
 * Carousel mờ dần giữa các slide. Tự chuyển mỗi 5 giây; dừng khi rê chuột,
 * khi focus bàn phím vào bên trong và khi người dùng bật giảm chuyển động.
 * Trên màn cảm ứng vuốt ngang để chuyển slide; nút mũi tên chỉ hiện từ `sm` để
 * không che ảnh banner trên điện thoại.
 */
export default function BannerCarousel({ slides }) {
  const [index, setIndex] = useState(0)
  const [hovered, setHovered] = useState(false)
  const [focused, setFocused] = useState(false)
  const touchStartX = useRef(null)
  const count = slides.length
  const current = count ? index % count : 0

  useEffect(() => {
    if (hovered || focused || count <= 1 || prefersReducedMotion()) return
    const timer = setInterval(() => setIndex((i) => (i + 1) % count), AUTO_SLIDE_MS)
    return () => clearInterval(timer)
  }, [hovered, focused, count])

  function go(delta) {
    setIndex((i) => (i + delta + count) % count)
  }

  function onTouchEnd(event) {
    if (touchStartX.current == null) return
    const dx = event.changedTouches[0].clientX - touchStartX.current
    touchStartX.current = null
    if (Math.abs(dx) >= SWIPE_MIN_PX) go(dx < 0 ? 1 : -1)
  }

  return (
    <section
      aria-roledescription="carousel"
      aria-label={m.ui_banner_carousel()}
      className="relative h-full overflow-hidden rounded-md"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setFocused(true)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false)
      }}
      onTouchStart={(event) => { touchStartX.current = event.touches[0].clientX }}
      onTouchEnd={onTouchEnd}
    >
      {slides.map((slide, i) => (
        <div
          key={i}
          role="group"
          aria-roledescription="slide"
          aria-label={m.ui_banner_slide({ index: i + 1, total: count })}
          aria-hidden={i !== current}
          inert={i !== current}
          className={`absolute inset-0 transition-opacity duration-700 motion-reduce:transition-none ${
            i === current ? 'opacity-100' : 'opacity-0 pointer-events-none'
          }`}
        >
          {slide}
        </div>
      ))}

      {count > 1 && (
        <>
          <button
            type="button"
            onClick={() => go(-1)}
            aria-label={m.ui_banner_previous()}
            className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/80 hover:bg-white hidden sm:flex items-center justify-center cursor-pointer shadow transition"
          >
            <LeftOutlined className="text-gray-700 text-xs" />
          </button>
          <button
            type="button"
            onClick={() => go(1)}
            aria-label={m.ui_banner_next()}
            className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/80 hover:bg-white hidden sm:flex items-center justify-center cursor-pointer shadow transition"
          >
            <RightOutlined className="text-gray-700 text-xs" />
          </button>
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
            {slides.map((_, i) => (
              <button
                type="button"
                key={i}
                onClick={() => setIndex(i)}
                aria-label={m.ui_banner_go_to({ index: i + 1 })}
                aria-current={i === current}
                className={`h-1.5 rounded-full cursor-pointer transition-all ${
                  i === current ? 'w-5 bg-white' : 'w-1.5 bg-white/50 hover:bg-white/70'
                }`}
              />
            ))}
          </div>
        </>
      )}
    </section>
  )
}
