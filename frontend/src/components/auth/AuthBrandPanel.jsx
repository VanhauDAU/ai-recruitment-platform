import { useEffect, useState } from 'react'
import { getJobStats } from '../../api/jobService'
import { formatNumber } from '../../constants/jobOptions'
import AuthChatShowcase from './AuthChatShowcase'

const BENEFITS = [
  { icon: '🤖', text: 'AI phân tích CV & gợi ý việc làm phù hợp' },
  { icon: '⚡', text: 'Kết nối ứng viên – nhà tuyển dụng tức thì' },
  { icon: '📊', text: 'Theo dõi hành trình ứng tuyển trực quan' },
  { icon: '🛡️', text: 'Bảo mật thông tin tuyệt đối' },
]

const TESTIMONIAL = {
  text: 'Đăng tin và duyệt hồ sơ nhanh hơn rất nhiều. Bộ lọc AI giúp tôi tìm đúng ứng viên chỉ trong vài phút.',
  name: 'Đặng Thị Minh Anh',
  role: 'Chuyên viên Tuyển dụng • Viettel Solutions',
  avatar: 'MA',
}

export default function AuthBrandPanel() {
  const [stats, setStats] = useState(null)

  useEffect(() => {
    getJobStats().then(setStats).catch(() => {})
  }, [])

  return (
    <div className="relative hidden overflow-hidden bg-gradient-to-br from-[#062817] via-[#0a3d22] to-[#062817] p-8 text-white lg:flex lg:flex-col xl:p-12">
      <style>{`
        @keyframes floatA { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-10px)} }
        @keyframes brandFade { from{opacity:0;transform:translateY(20px)} to{opacity:1;transform:translateY(0)} }
        .brand-fade-1 { animation: brandFade 0.6s 0.1s both; }
        .brand-fade-2 { animation: brandFade 0.6s 0.25s both; }
        .brand-fade-3 { animation: brandFade 0.6s 0.4s both; }
        .brand-fade-4 { animation: brandFade 0.6s 0.55s both; }
        .float-a { animation: floatA 6s ease-in-out infinite; }
      `}</style>

      {/* Decorative background */}
      <div className="pointer-events-none absolute inset-0">
        <svg className="absolute inset-0 h-full w-full opacity-[0.06]" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="bgrid" width="32" height="32" patternUnits="userSpaceOnUse">
              <path d="M 32 0 L 0 0 0 32" fill="none" stroke="white" strokeWidth="0.8" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#bgrid)" />
        </svg>
        <div className="absolute -top-20 -left-10 h-80 w-80 rounded-full bg-[#00b14f]/20 blur-3xl" />
        <div className="absolute bottom-10 right-0 h-72 w-72 rounded-full bg-[#3ddc84]/10 blur-3xl" />
      </div>

      {/* Header: logo + "Hồ sơ mới" card */}
      <div className="brand-fade-1 relative flex items-start justify-between gap-4">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#00b14f] shadow-lg shadow-[#00b14f]/30">
            <span className="text-sm font-black text-white">AI</span>
          </div>
          <span className="text-lg font-bold tracking-tight">
            AI Career <span className="text-[#4ade80]">Coach</span>
          </span>
        </div>

        <div className="float-a rounded-2xl border border-white/10 bg-white/[0.07] px-3.5 py-2.5 shadow-xl backdrop-blur-sm">
          <div className="flex items-center gap-2.5">
            <div className="flex -space-x-1.5">
              {['#00b14f', '#3ddc84', '#f59e0b'].map((c, i) => (
                <div
                  key={i}
                  className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-[#0a3d22] text-[9px] font-bold text-white"
                  style={{ background: c }}
                >
                  {['TA', 'BN', 'MG'][i]}
                </div>
              ))}
            </div>
            <div className="leading-tight">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-green-100/60">Hồ sơ mới</p>
              <p className="text-xs font-bold text-white">+128 hôm nay</p>
            </div>
          </div>
        </div>
      </div>

      {/* Main: text + stats (left) · chat (right) */}
      <div className="relative mt-10 grid flex-1 grid-cols-1 items-center gap-8 xl:grid-cols-[1.05fr_1fr] xl:gap-10">
        {/* Left column */}
        <div>
          <h1 className="brand-fade-2 text-3xl font-extrabold leading-tight tracking-tight xl:text-4xl">
            Tiếp lợi thế,<br />
            <span className="bg-gradient-to-r from-[#4ade80] to-[#00b14f] bg-clip-text text-transparent">
              nối thành công.
            </span>
          </h1>
          <p className="brand-fade-3 mt-4 max-w-md text-sm leading-relaxed text-green-50/70">
            Nền tảng nhân sự ứng dụng AI: tạo CV, phân tích hồ sơ, tìm việc và tuyển dụng thông minh hơn mỗi ngày.
          </p>

          <ul className="brand-fade-3 mt-6 space-y-3">
            {BENEFITS.map(({ icon, text }) => (
              <li key={text} className="flex items-start gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#00b14f]/20 text-base">
                  {icon}
                </span>
                <span className="pt-0.5 text-sm leading-snug text-green-50/80">{text}</span>
              </li>
            ))}
          </ul>

          {stats && (
            <div className="brand-fade-4 mt-7 grid max-w-md grid-cols-2 gap-4">
              {[
                { value: stats.active_jobs, label: 'Việc đang tuyển' },
                { value: stats.companies, label: 'Công ty tuyển dụng' },
              ].map(({ value, label }) => (
                <div key={label} className="rounded-xl border border-white/10 bg-white/5 px-4 py-3">
                  <p className="text-2xl font-extrabold tabular-nums text-white">{formatNumber(value)}</p>
                  <p className="mt-0.5 text-xs uppercase tracking-wide text-green-100/50">{label}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right column: animated conversation */}
        <div className="brand-fade-4 flex justify-center xl:justify-end">
          <AuthChatShowcase />
        </div>
      </div>

      {/* Testimonial (full width, compact) */}
      <div className="brand-fade-4 relative mt-8 flex items-start gap-3 rounded-xl border border-white/10 bg-white/5 px-4 py-3 backdrop-blur-sm">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#00b14f] to-[#008a3e] text-xs font-bold text-white">
          {TESTIMONIAL.avatar}
        </div>
        <div className="min-w-0">
          <div className="mb-1 flex gap-0.5">
            {Array.from({ length: 5 }).map((_, i) => (
              <svg key={i} className="h-2.5 w-2.5 text-[#fbbf24]" fill="currentColor" viewBox="0 0 20 20">
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
            ))}
          </div>
          <p className="text-xs italic leading-snug text-green-50/75 line-clamp-2">"{TESTIMONIAL.text}"</p>
          <p className="mt-1 truncate text-[11px] text-green-100/55">
            {TESTIMONIAL.name} · {TESTIMONIAL.role}
          </p>
        </div>
      </div>
    </div>
  )
}
