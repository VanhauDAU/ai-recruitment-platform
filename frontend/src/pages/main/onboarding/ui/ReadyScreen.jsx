import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router'
import { buildReadySpeech, InterviewMascot } from '@/widgets/onboarding-interview'

// Ngắn hơn mốc 9 giây cũ vì đồng hồ chỉ chạy sau khi robot nói dứt câu.
const COUNTDOWN_SECONDS = 5
/** Chốt chặn phòng khi audio treo: không để ứng viên kẹt lại màn này. */
const SPEECH_TIMEOUT_MS = 14_000

// Màn hoàn tất onboarding: robot chốt lại bằng chính nhu cầu vừa lưu rồi đếm
// ngược sang trang việc làm đã lọc sẵn (targetUrl); bấm nút thì đi ngay.
export default function ReadyScreen({ preference, targetUrl, user }) {
  const navigate = useNavigate()
  const [secondsLeft, setSecondsLeft] = useState(COUNTDOWN_SECONDS)
  // Chỉ đếm ngược sau khi robot nói dứt câu — trước đây đếm song song nên
  // ứng viên bị chuyển trang giữa lúc robot đang chốt.
  const [spoken, setSpoken] = useState(false)
  const speech = useMemo(() => buildReadySpeech(preference, user), [preference, user])
  const markSpoken = useCallback(() => setSpoken(true), [])

  useEffect(() => {
    const timer = setTimeout(markSpoken, SPEECH_TIMEOUT_MS)
    return () => clearTimeout(timer)
  }, [markSpoken])

  useEffect(() => {
    if (!spoken) return undefined
    if (secondsLeft <= 0) {
      navigate(targetUrl, { replace: true })
      return undefined
    }
    const timer = setTimeout(() => setSecondsLeft((value) => value - 1), 1000)
    return () => clearTimeout(timer)
  }, [navigate, secondsLeft, spoken, targetUrl])

  return (
    <section className="flex flex-1 items-center justify-center px-4 py-10">
      <div className="w-full max-w-3xl rounded-3xl bg-gradient-to-b from-white/15 to-emerald-950/25 px-5 py-10 shadow-2xl shadow-emerald-950/30 sm:px-12 sm:py-12">
        <InterviewMascot
          emotion="success"
          float
          onSpoken={markSpoken}
          pose="thumbsUp"
          speech={speech}
          speechId="ready"
        />

        <div className="mt-6 text-center">
          <p className="text-sm text-white/85 sm:text-base">
            {spoken ? (
              <>
                Hệ thống sẽ tự động chuyển bạn đến trang việc làm sau{' '}
                <span className="font-bold text-amber-300">{secondsLeft}</span> giây
              </>
            ) : 'Hệ thống sẽ tự động chuyển bạn đến trang việc làm ngay sau đây'}
          </p>
          <button
            type="button"
            onClick={() => navigate(targetUrl, { replace: true })}
            className="mt-5 inline-flex cursor-pointer items-center justify-center rounded-full bg-emerald-600 px-7 py-3 text-sm font-semibold text-white shadow-lg shadow-emerald-950/30 transition hover:bg-emerald-500"
          >
            Đi tới Danh sách việc làm&nbsp;<span className="font-normal">(dành riêng cho bạn)</span>
          </button>
        </div>
      </div>
    </section>
  )
}
