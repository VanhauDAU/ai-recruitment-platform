import { PhoneOutlined } from '@ant-design/icons'
import { Link } from 'react-router'
import AuthLogo from './AuthLogo'
import LoginForm from './LoginForm'
import SocialLoginButtons from './SocialLoginButtons'
import { m } from '@/shared/config/i18n'

// Cổng ứng viên. `onSuccess`: nếu truyền (vd. khi nhúng trong modal), gọi callback
// thay vì điều hướng tới dashboard — để nơi gọi tự xử lý (đóng modal, ở lại trang...).
export default function CandidateLoginContent({ onSuccess }) {
  return (
    <div className="w-full">
      {/* Tiêu đề */}
      <div className="login-card mb-5 text-center">
        <AuthLogo className="mb-3" />
        <h2 className="text-lg font-bold text-gray-900 dark:text-white sm:text-xl">
          {m.account_auth_candidate_welcome()}
        </h2>
      </div>

      {/* Social login */}
      <div className="login-field mb-4">
        <SocialLoginButtons portal="main" action={m.account_social_action_login()} onSuccess={onSuccess} />
      </div>

      {/* Divider */}
      <div className="login-field flex items-center gap-3 mb-4">
        <div className="divider-line" />
        <span className="shrink-0 text-xs font-medium text-gray-400 uppercase tracking-widest">
          {m.account_auth_or_email()}
        </span>
        <div className="divider-line" />
      </div>

      <LoginForm
        portal="main"
        expectedRoles={['candidate']}
        onSuccess={onSuccess}
        withMascot={!onSuccess}
      />

      {/* Register link */}
      <div className="login-field mt-4 text-center">
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {m.account_auth_no_account()}{' '}
          <Link
            to="/sign-up"
            className="font-semibold text-[var(--brand-primary)] hover:text-[var(--brand-primary-hover)] hover:underline transition-colors"
          >
            {m.account_auth_register_now()}
          </Link>
        </p>
      </div>

      {/* Support hotline: trong popup trên mobile thì ẩn để form gọn, vừa một màn hình. */}
      <div className={`login-field mt-4 rounded-2xl border border-gray-100 bg-gray-50 px-4 py-3.5 dark:border-zinc-800 dark:bg-zinc-900 ${onSuccess ? 'hidden sm:block' : ''}`}>
        <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed text-center">
          {m.account_auth_help_question()}{' '}
          <br className="sm:hidden" />
          {m.account_auth_help_call()}{' '}
          <a
            href="tel:0777464347"
            className="inline-flex items-center gap-1 font-semibold text-[var(--brand-primary)] hover:underline"
          >
            <PhoneOutlined className="text-[11px]" />
            0777 46 43 47
          </a>
          {' '}{m.account_auth_help_hours()}
        </p>
      </div>
    </div>
  )
}
