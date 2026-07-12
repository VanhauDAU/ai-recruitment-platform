import { ArrowRightOutlined } from '@ant-design/icons'
import { Link } from 'react-router-dom'

const GRADIENTS = {
  green: 'from-emerald-600 via-emerald-500 to-teal-400',
  blue: 'from-sky-600 via-blue-500 to-indigo-400',
  orange: 'from-orange-500 via-rose-400 to-pink-400',
}

// Banner "ảnh giả button": cả khối là MỘT link (kiểu TopCV — ảnh có vẽ nút,
// bấm đâu cũng chuyển trang). Có ảnh thì dùng ảnh; chưa có thì nền gradient
// + nút giả (span) để giữ đúng hành vi.
export default function BlogInlineBanner({ banner, className = '' }) {
  if (!banner) return null
  const inner = banner.image_url ? (
    <img src={banner.image_url} alt={banner.title} loading="lazy" className="h-full w-full object-cover" />
  ) : (
    <div className={`flex h-full flex-col justify-center gap-2 bg-gradient-to-r px-6 py-8 text-white sm:px-10 ${GRADIENTS[banner.theme] || GRADIENTS.green}`}>
      {banner.eyebrow && (
        <span className="text-xs font-bold uppercase tracking-[0.2em] opacity-90">{banner.eyebrow}</span>
      )}
      <span className="max-w-xl text-xl font-extrabold leading-7 sm:text-2xl sm:leading-8">{banner.title}</span>
      {banner.subtitle && <span className="max-w-lg text-sm opacity-90">{banner.subtitle}</span>}
      {banner.cta_label && (
        <span className="mt-3 inline-flex w-fit items-center gap-2 rounded-full bg-white px-5 py-2.5 text-sm font-bold text-slate-800 shadow-lg transition-transform duration-300 group-hover:scale-105">
          {banner.cta_label}
          <ArrowRightOutlined className="text-[var(--brand-primary)] transition-transform duration-300 group-hover:translate-x-1" />
        </span>
      )}
    </div>
  )

  const frame = (
    <div className="h-full min-h-44 overflow-hidden rounded-xl shadow-sm transition-shadow duration-300 group-hover:shadow-xl sm:min-h-48 sm:rounded-2xl">
      {inner}
    </div>
  )

  const url = banner.cta_url || ''
  const external = /^https?:\/\//i.test(url)
  if (external) {
    return <a href={url} target="_blank" rel="noopener noreferrer" className={`group block h-full ${className}`}>{frame}</a>
  }
  return <Link to={url || '/'} target="_blank" rel="noopener" className={`group block h-full ${className}`}>{frame}</Link>
}
