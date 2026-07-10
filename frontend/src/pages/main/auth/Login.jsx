import { PhoneOutlined } from '@ant-design/icons'
import { Link } from 'react-router-dom'
import AuthLogo from '../../../components/auth/AuthLogo'
import LoginForm from '../../../components/auth/LoginForm'
import SocialLoginButtons from '../../../components/auth/SocialLoginButtons'

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
        <SocialLoginButtons portal="main" action="Đăng nhập" />
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
            className="font-semibold text-[var(--brand-primary)] hover:text-[var(--brand-primary-hover)] hover:underline transition-colors"
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
            className="inline-flex items-center gap-1 font-semibold text-[var(--brand-primary)] hover:underline"
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
