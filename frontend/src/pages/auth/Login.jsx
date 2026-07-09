import { PhoneOutlined } from '@ant-design/icons'
import { Link } from 'react-router-dom'
import AuthLogo from '../../components/auth/AuthLogo'
import LoginForm from '../../components/auth/LoginForm'

// SVG icons for social providers
function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-5 h-5" aria-hidden="true">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  )
}

function FacebookIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-5 h-5" aria-hidden="true" fill="#1877F2">
      <path d="M24 12.073C24 5.405 18.627 0 12 0S0 5.405 0 12.073C0 18.1 4.388 23.094 10.125 24v-8.437H7.078v-3.49h3.047V9.41c0-3.025 1.792-4.697 4.533-4.697 1.312 0 2.686.236 2.686.236v2.97h-1.513c-1.491 0-1.956.93-1.956 1.886v2.267h3.328l-.532 3.49h-2.796V24C19.612 23.094 24 18.1 24 12.073z"/>
    </svg>
  )
}

function LinkedInIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-5 h-5" aria-hidden="true" fill="#0A66C2">
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
    </svg>
  )
}

const SOCIAL_PROVIDERS = [
  { key: 'google', label: 'Google', Icon: GoogleIcon, span: 'col-span-12', border: 'border-[#dadce0] hover:border-[#4285F4] hover:bg-blue-50/40' },
  { key: 'facebook', label: 'Facebook', Icon: FacebookIcon, span: 'col-span-12 sm:col-span-6', border: 'border-[#dadce0] hover:border-[#1877F2] hover:bg-blue-50/40' },
  { key: 'linkedin', label: 'LinkedIn', Icon: LinkedInIcon, span: 'col-span-12 sm:col-span-6', border: 'border-[#dadce0] hover:border-[#0A66C2] hover:bg-blue-50/40' },
]

// Cổng ứng viên. `onSuccess`: nếu truyền (vd. khi nhúng trong modal), gọi callback
// thay vì điều hướng tới dashboard — để nơi gọi tự xử lý (đóng modal, ở lại trang...).
export default function Login({ onSuccess }) {
  return (
    <div className="w-full">
      {/* Tiêu đề */}
      <div className="login-card mb-7 text-center">
        <AuthLogo className="mb-3" />
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">
          Chào mừng quay trở lại
        </h2>
      </div>

      {/* Social login */}
      <div className="login-field mb-5">
        <div className="grid grid-cols-12 gap-3">
          {SOCIAL_PROVIDERS.map(({ key, label, Icon, span, border }) => (
            <button
              key={key}
              type="button"
              aria-label={`Đăng nhập bằng ${label}`}
              className={`social-btn ${span} flex h-11 items-center justify-center gap-2 rounded-full border bg-white px-4 text-sm font-medium text-gray-700 cursor-pointer dark:bg-zinc-800 dark:text-gray-200 dark:border-zinc-700 ${border}`}
            >
              <Icon />
              <span>{label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Divider */}
      <div className="login-field flex items-center gap-3 mb-5">
        <div className="divider-line" />
        <span className="shrink-0 text-xs font-medium text-gray-400 uppercase tracking-widest">
          hoặc đăng nhập bằng email
        </span>
        <div className="divider-line" />
      </div>

      <LoginForm portal="main" expectedRoles={['candidate']} onSuccess={onSuccess} />

      {/* Register link */}
      <div className="login-field mt-6 text-center">
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Bạn chưa có tài khoản?{' '}
          <Link
            to="/sign-up"
            className="font-semibold text-[#00b14f] hover:text-[#008a3e] hover:underline transition-colors"
          >
            Đăng ký ngay
          </Link>
        </p>
      </div>

      {/* Support hotline */}
      <div className="login-field mt-6 rounded-2xl border border-gray-100 bg-gray-50 px-4 py-3.5 dark:border-zinc-800 dark:bg-zinc-900">
        <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed text-center">
          Bạn có gặp khó khăn khi tạo tài khoản?{' '}
          <br className="sm:hidden" />
          Vui lòng gọi tới số{' '}
          <a
            href="tel:0777464347"
            className="inline-flex items-center gap-1 font-semibold text-[#00b14f] hover:underline"
          >
            <PhoneOutlined className="text-[11px]" />
            0777 46 43 47
          </a>
          {' '}(Giờ hành chính)
        </p>
      </div>
    </div>
  )
}
