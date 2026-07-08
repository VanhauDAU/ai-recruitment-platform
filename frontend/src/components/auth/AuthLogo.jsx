import { Link } from 'react-router-dom'

const CONFIGURED_LOGO_URL = import.meta.env.VITE_SITE_LOGO_URL || ''

export default function AuthLogo({ className = '' }) {
  if (CONFIGURED_LOGO_URL) {
    return (
      <Link to="/" aria-label="Về trang chủ" className={`mx-auto block h-14 w-14 ${className}`}>
        <img
          src={CONFIGURED_LOGO_URL}
          alt="AI Career Coach"
          className="h-full w-full object-contain"
        />
      </Link>
    )
  }

  return (
    <Link
      to="/"
      className={`mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-[#00b14f] to-[#008a3e] shadow-lg shadow-[#00b14f]/25 transition hover:-translate-y-0.5 hover:shadow-[#00b14f]/35 ${className}`}
      aria-label="Về trang chủ"
    >
      <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" aria-hidden="true">
        <path d="M13 3L4 14h8l-1 7 9-11h-8l1-7z" fill="white" />
      </svg>
    </Link>
  )
}
