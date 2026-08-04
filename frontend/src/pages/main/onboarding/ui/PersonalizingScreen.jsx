import { useCallback, useEffect, useState } from 'react'
import { InterviewMascot, SAVING_SPEECH } from '@/widgets/onboarding-interview'

const HIGHLIGHTS = ['Trải nghiệm tìm việc cá nhân hoá', 'Gợi ý công việc phù hợp', 'Hỗ trợ bởi AI']
const BAR_DURATION_MS = 3200
/** Chốt chặn phòng khi audio treo: không để ứng viên kẹt lại màn này. */
const SPEECH_TIMEOUT_MS = 9000

// Màn chờ sau khi lưu nhu cầu: chạy thanh tiến trình ~3s rồi báo xong để
// chuyển sang màn "đã sẵn sàng". Chỉ là hiệu ứng trải nghiệm, không gọi API.
// Chỉ chuyển khi thanh chạy hết VÀ robot nói dứt câu, tránh cắt ngang giọng đọc.
export default function PersonalizingScreen({ onDone }) {
  const [started, setStarted] = useState(false)
  const [barDone, setBarDone] = useState(false)
  const [spoken, setSpoken] = useState(false)
  const markSpoken = useCallback(() => setSpoken(true), [])

  useEffect(() => {
    const raf = requestAnimationFrame(() => setStarted(true))
    const bar = setTimeout(() => setBarDone(true), BAR_DURATION_MS)
    const fallback = setTimeout(markSpoken, SPEECH_TIMEOUT_MS)
    return () => {
      cancelAnimationFrame(raf)
      clearTimeout(bar)
      clearTimeout(fallback)
    }
  }, [markSpoken])

  useEffect(() => {
    if (barDone && spoken) onDone()
  }, [barDone, onDone, spoken])

  return (
    <section className="flex flex-1 items-center justify-center px-4 py-10">
      <div className="w-full max-w-3xl rounded-3xl bg-gradient-to-b from-white/15 to-emerald-950/25 px-5 py-10 text-center shadow-2xl shadow-emerald-950/30 sm:px-12 sm:py-14">
        <InterviewMascot
          emotion="thinking"
          onSpoken={markSpoken}
          pose="checklist"
          speech={SAVING_SPEECH}
          speechId="personalizing"
        />

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
