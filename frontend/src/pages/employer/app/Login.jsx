import { Link } from 'react-router-dom'
import { AuthLogo, LoginForm, SocialLoginButtons } from '@/features/auth'
import { EMPLOYER_FORGOT_PASSWORD_URL, employerAppPath, MAIN_LOGIN_URL } from '@/shared/config/portals'

// Cổng nhà tuyển dụng — sau này chạy trên subdomain riêng (vd. tuyendung.procv.vn).
export default function EmployerLogin() {
  return (
    <div className="w-full rounded-2xl bg-white p-1 sm:p-3">
      <div className="login-card mb-7">
        <AuthLogo className="mb-8 justify-start" />
        <h1 className="text-3xl font-black tracking-tight text-slate-950">
          Chào mừng bạn quay trở lại
        </h1>
        <p className="mt-3 text-sm leading-6 text-slate-500">
          Quản lý tin tuyển dụng, ứng viên và hiệu quả tuyển dụng trên một nền tảng thống nhất.
        </p>
      </div>

      <div className="login-field mb-5">
        <SocialLoginButtons portal="employer" action="Đăng nhập" appearance="employer" />
      </div>

      <div className="login-field mb-5 flex items-center gap-3">
        <div className="divider-line" />
        <span className="shrink-0 text-xs font-medium uppercase tracking-widest text-gray-400">
          hoặc bằng email
        </span>
        <div className="divider-line" />
      </div>

      <LoginForm
        portal="employer"
        expectedRoles={['employer']}
        forgotPasswordLink={EMPLOYER_FORGOT_PASSWORD_URL}
        appearance="employer"
      />

      <div className="login-field mt-6 border-t border-slate-100 pt-5 text-center">
        <p className="text-sm text-gray-500">
          Chưa có tài khoản?{' '}
          <Link
            to={employerAppPath('/register')}
            className="font-semibold text-[var(--brand-primary)] transition-colors hover:text-[var(--brand-primary-hover)] hover:underline"
          >
            Đăng ký ngay
          </Link>
        </p>
        <p className="mt-3 text-xs text-gray-400">
          Bạn là ứng viên?{' '}
          <a href={MAIN_LOGIN_URL} className="font-medium text-gray-500 hover:text-[var(--brand-primary)] hover:underline">
            Đăng nhập tại cổng ứng viên
          </a>
        </p>
      </div>
    </div>
  )
}
