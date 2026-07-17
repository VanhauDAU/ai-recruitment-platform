import { useEffect, useState } from 'react'

const HIGHLIGHTS = ['Trải nghiệm tìm việc cá nhân hoá', 'Gợi ý công việc phù hợp', 'Hỗ trợ bởi AI']

// Màn chờ sau khi lưu nhu cầu: chạy thanh tiến trình ~3s rồi báo xong để
// chuyển sang màn "đã sẵn sàng". Chỉ là hiệu ứng trải nghiệm, không gọi API.
export default function PersonalizingScreen({ onDone }) {
  const [started, setStarted] = useState(false)

  useEffect(() => {
    const raf = requestAnimationFrame(() => setStarted(true))
    const timer = setTimeout(onDone, 3200)
    return () => {
      cancelAnimationFrame(raf)
      clearTimeout(timer)
    }
    // onDone chỉ đổi phase ở cha, không cần chạy lại hiệu ứng.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <section className="flex flex-1 items-center justify-center px-4 py-10">
      <div className="w-full max-w-3xl rounded-3xl bg-gradient-to-b from-white/15 to-emerald-950/25 px-5 py-10 text-center shadow-2xl shadow-emerald-950/30 sm:px-12 sm:py-14">
        <h1 className="mx-auto max-w-xl text-xl font-bold leading-snug text-white sm:text-[26px]">
          Chờ chút nhé, ProCV AI đang cá nhân hoá trải nghiệm dành cho bạn
        </h1>

        <div className="mt-6 flex flex-wrap items-center justify-center gap-2.5 sm:gap-3">
          {HIGHLIGHTS.map((text) => (
            <span key={text} className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-400/80 px-3 py-1.5 text-xs font-semibold text-emerald-950 sm:text-sm">
              <span aria-hidden="true">✦</span>
              {text}
            </span>
          ))}
        </div>

        <div className="mx-auto mt-8 h-2 max-w-xl overflow-hidden rounded-full bg-emerald-950/60">
          <div
            className="h-full rounded-full bg-gradient-to-r from-emerald-500 via-emerald-300 to-lime-300 transition-[width] duration-[3000ms] ease-out"
            style={{ width: started ? '100%' : '4%' }}
          />
        </div>
      </div>
    </section>
  )
}
