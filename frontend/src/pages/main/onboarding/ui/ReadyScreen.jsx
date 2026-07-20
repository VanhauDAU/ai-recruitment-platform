import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { legacyAsset } from '@/shared/config/assets'

const MASCOT_IMAGE = legacyAsset('cv-template/toppy-list-mau-cv.png')
const COUNTDOWN_SECONDS = 9

// Màn hoàn tất onboarding: đếm ngược rồi tự chuyển sang trang việc làm với
// bộ lọc cá nhân hoá (targetUrl); bấm nút thì đi ngay không cần chờ.
export default function ReadyScreen({ targetUrl }) {
  const navigate = useNavigate()
  const [secondsLeft, setSecondsLeft] = useState(COUNTDOWN_SECONDS)

  useEffect(() => {
    if (secondsLeft <= 0) {
      navigate(targetUrl, { replace: true })
      return undefined
    }
    const timer = setTimeout(() => setSecondsLeft((value) => value - 1), 1000)
    return () => clearTimeout(timer)
  }, [secondsLeft, navigate, targetUrl])

  return (
    <section className="flex flex-1 items-center justify-center px-4 py-10">
      <div className="flex w-full max-w-3xl flex-col items-center gap-6 rounded-3xl bg-gradient-to-b from-white/15 to-emerald-950/25 px-5 py-10 shadow-2xl shadow-emerald-950/30 sm:flex-row sm:gap-8 sm:px-12 sm:py-12">
        <div className="flex-1 text-center sm:text-left">
          <h1 className="text-xl font-bold leading-snug text-white sm:text-2xl">
            Hệ thống đã hoàn tất tiếp nhận thông tin. Mọi thứ đã sẵn sàng!
          </h1>
          <p className="mt-3 text-sm text-white/85 sm:text-base">
            Hệ thống sẽ tự động chuyển bạn đến trang việc làm sau{' '}
            <span className="font-bold text-amber-300">{secondsLeft}</span> giây
          </p>
          <button
            type="button"
            onClick={() => navigate(targetUrl, { replace: true })}
            className="mt-6 inline-flex cursor-pointer items-center justify-center rounded-full bg-emerald-600 px-7 py-3 text-sm font-semibold text-white shadow-lg shadow-emerald-950/30 transition hover:bg-emerald-500"
          >
            Đi tới Danh sách việc làm&nbsp;<span className="font-normal">(dành riêng cho bạn)</span>
          </button>
        </div>
        <img
          src={MASCOT_IMAGE}
          alt="ProCV AI"
          className="w-36 shrink-0 sm:w-44"
          loading="lazy"
        />
      </div>
    </section>
  )
}
