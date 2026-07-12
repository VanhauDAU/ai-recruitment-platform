import { LeftOutlined, RightOutlined } from '@ant-design/icons'
import { useEffect, useState } from 'react'

const AUTO_SLIDE_MS = 5000

export default function BannerCarousel({ slides }) {
  const [index, setIndex] = useState(0)
  const [paused, setPaused] = useState(false)

  useEffect(() => {
    if (paused || slides.length <= 1) return
    const timer = setInterval(() => setIndex((i) => (i + 1) % slides.length), AUTO_SLIDE_MS)
    return () => clearInterval(timer)
  }, [paused, slides.length])

  function go(delta) {
    setIndex((i) => (i + delta + slides.length) % slides.length)
  }

  return (
    <div
      className="relative h-full rounded-md overflow-hidden"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {slides.map((slide, i) => (
        <div
          key={i}
          className={`absolute inset-0 transition-opacity duration-700 ${
            i === index ? 'opacity-100' : 'opacity-0 pointer-events-none'
          }`}
        >
          {slide}
        </div>
      ))}

      {slides.length > 1 && (
        <>
          <button
            onClick={() => go(-1)}
            aria-label="Banner trước"
            className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/80 hover:bg-white flex items-center justify-center cursor-pointer shadow transition"
          >
            <LeftOutlined className="text-gray-700 text-xs" />
          </button>
          <button
            onClick={() => go(1)}
            aria-label="Banner tiếp theo"
            className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/80 hover:bg-white flex items-center justify-center cursor-pointer shadow transition"
          >
            <RightOutlined className="text-gray-700 text-xs" />
          </button>
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
            {slides.map((_, i) => (
              <button
                key={i}
                onClick={() => setIndex(i)}
                aria-label={`Chuyển đến banner ${i + 1}`}
                className={`h-1.5 rounded-full cursor-pointer transition-all ${
                  i === index ? 'w-5 bg-white' : 'w-1.5 bg-white/50 hover:bg-white/70'
                }`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  )
}
