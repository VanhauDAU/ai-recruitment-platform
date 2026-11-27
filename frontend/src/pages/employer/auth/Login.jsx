import { Link } from 'react-router'
import { AuthLogo, LoginForm, SocialLoginButtons } from '@/features/common/account/auth'
import { EMPLOYER_FORGOT_PASSWORD_URL, employerAppPath, MAIN_LOGIN_URL } from '@/shared/config/portals'
import { useMediaQuery } from '@/shared/hooks/use-media-query'
import { m } from '@/shared/config/i18n'
import './employer-auth.css'

function OrDivider({ label, className }) {
  return (
    <div className={`login-field flex items-center gap-3 ${className}`}>
      <div className="divider-line" />
      <span className="shrink-0 text-xs font-medium uppercase tracking-widest text-gray-400">{label}</span>
      <div className="divider-line" />
    </div>
  )
}

// Cổng nhà tuyển dụng — sau này chạy trên subdomain riêng (vd. tuyendung.procv.vn).
export default function EmployerLogin() {
  // Điện thoại: form email lên trước, Google xuống dưới để ô nhập nằm trong màn hình đầu.
  const isMobile = useMediaQuery('(max-width: 639.98px)')
  const social = (
    <div className="login-field mb-5">
      <SocialLoginButtons portal="employer" action={m.account_social_action_login()} appearance="employer" />
    </div>
  )

  return (
    <div className="employer-login w-full rounded-2xl bg-white p-1 sm:p-3">
      <div className="login-card employer-auth-header mb-7">
        <AuthLogo className="employer-auth-logo mb-8 justify-start" />
        <h1 className="employer-auth-title text-3xl font-black tracking-tight text-slate-950">
          {m.employer_account_login_title()}
        </h1>
        <p className="employer-auth-subtitle mt-3 text-sm leading-6 text-slate-500">
          {m.employer_account_login_subtitle()}
        </p>
      </div>

      {!isMobile && social}
      {!isMobile && <OrDivider label={m.employer_account_login_or_email()} className="mb-5" />}

      <LoginForm
        portal="employer"
        expectedRoles={['employer']}
        forgotPasswordLink={EMPLOYER_FORGOT_PASSWORD_URL}
        appearance="employer"
      />

      {isMobile && <OrDivider label={m.employer_account_login_or()} className="my-5" />}
      {isMobile && social}

      <div className="login-field mt-6 border-t border-slate-100 pt-5 text-center">
        <p className="text-sm text-gray-500">
          {m.employer_account_login_no_account()}{' '}
          <Link
            to={employerAppPath('/dang-ky')}
            className="font-semibold text-[var(--brand-primary)] transition-colors hover:text-[var(--brand-primary-hover)] hover:underline"
          >
            {m.employer_account_login_register_now()}
          </Link>
        </p>
        <p className="mt-3 text-xs text-gray-400">
          {m.employer_account_login_are_you_candidate()}{' '}
          <a href={MAIN_LOGIN_URL} className="font-medium text-gray-500 hover:text-[var(--brand-primary)] hover:underline">
            {m.employer_account_login_candidate_portal()}
          </a>
        </p>
      </div>
    </div>
  )
}
