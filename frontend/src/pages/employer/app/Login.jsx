import { Link } from 'react-router-dom'
import AuthLogo from '../../../components/auth/AuthLogo'
import LoginForm from '../../../components/auth/LoginForm'
import { employerAppPath, MAIN_LOGIN_URL } from '../../../config/portals'

// Cổng nhà tuyển dụng — sau này chạy trên subdomain riêng (vd. tuyendung.procv.vn).
export default function EmployerLogin() {
  return (
    <div className="w-full">
      <div className="login-card mb-7 text-center">
        <AuthLogo className="mb-3" />
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">
          Đăng nhập dành cho Nhà tuyển dụng
        </h2>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Đăng tin tuyển dụng và tìm kiếm hồ sơ ứng viên.
        </p>
      </div>

      <LoginForm portal="employer" expectedRoles={['employer']} />

      <div className="login-field mt-6 text-center">
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Chưa có tài khoản?{' '}
          <Link
            to={employerAppPath('/register')}
            className="font-semibold text-[var(--brand-primary)] hover:text-[var(--brand-primary-hover)] hover:underline transition-colors"
          >
            Đăng ký ngay
          </Link>
        </p>
        <p className="mt-2 text-xs text-gray-400">
          Bạn là ứng viên?{' '}
          <a href={MAIN_LOGIN_URL} className="font-medium text-gray-500 hover:text-[var(--brand-primary)] hover:underline">
            Đăng nhập tại đây
          </a>
        </p>
      </div>
    </div>
  )
}
