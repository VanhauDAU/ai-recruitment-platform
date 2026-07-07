import { useEffect, useState } from 'react'
import { getJobStats } from '../../api/jobService'
import { formatNumber } from '../../constants/jobOptions'

export default function AuthBrandPanel() {
  const [stats, setStats] = useState(null)

  useEffect(() => {
    getJobStats().then(setStats).catch(() => {})
  }, [])

  return (
    <div className="relative hidden overflow-hidden bg-gradient-to-br from-[#0f3d2e] to-[#0a2a20] p-12 text-white lg:flex lg:flex-col lg:justify-between">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-24 -left-10 h-72 w-72 rounded-full bg-[#5dffa3]/15 blur-3xl" />
        <div className="absolute bottom-0 right-0 h-80 w-80 rounded-full bg-[#3ddc84]/10 blur-3xl" />
      </div>

      <div className="relative">
        <h1 className="max-w-sm text-3xl font-bold leading-tight tracking-tight">
          Tiếp lợi thế, nối thành công.
        </h1>
        <p className="mt-4 max-w-sm text-sm leading-relaxed text-green-50/80">
          Nền tảng nhân sự ứng dụng AI: tạo CV, phân tích hồ sơ, tìm việc và tuyển dụng hiệu quả hơn.
        </p>

        {stats && (
          <div className="mt-8 flex gap-6">
            <div>
              <p className="text-2xl font-bold tabular-nums">{formatNumber(stats.active_jobs)}</p>
              <p className="text-xs text-green-100/70">Việc làm đang tuyển</p>
            </div>
            <div>
              <p className="text-2xl font-bold tabular-nums">{formatNumber(stats.companies)}</p>
              <p className="text-xs text-green-100/70">Công ty đang tuyển</p>
            </div>
          </div>
        )}
      </div>

      <div className="relative mt-12 rounded-2xl border border-white/10 bg-white/5 p-5">
        <p className="text-sm leading-relaxed text-green-50/90">
          Đăng tin và duyệt hồ sơ nhanh hơn nhiều so với các nền tảng cũ. Bộ lọc kỹ năng giúp tôi tìm đúng ứng viên chỉ trong vài phút.
        </p>
        <p className="mt-3 text-xs text-green-100/60">
          Đặng Thị Minh Anh, Chuyên viên Tuyển dụng tại Viettel Solutions
        </p>
      </div>
    </div>
  )
}
