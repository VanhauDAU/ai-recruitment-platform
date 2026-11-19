import { Link } from 'react-router'
import { AuthLogo, LoginForm, SocialLoginButtons } from '@/features/common/account/auth'
import { EMPLOYER_FORGOT_PASSWORD_URL, employerAppPath, MAIN_LOGIN_URL } from '@/shared/config/portals'
import { m } from '@/shared/config/i18n'

// Cổng nhà tuyển dụng — sau này chạy trên subdomain riêng (vd. tuyendung.procv.vn).
export default function EmployerLogin() {
  return (
    <div className="w-full rounded-2xl bg-white p-1 sm:p-3">
      <div className="login-card mb-7">
        <AuthLogo className="mb-8 justify-start" />
        <h1 className="text-3xl font-black tracking-tight text-slate-950">
          {m.employer_account_login_title()}
        </h1>
        <p className="mt-3 text-sm leading-6 text-slate-500">
          {m.employer_account_login_subtitle()}
        </p>
      </div>

      <div className="login-field mb-5">
        <SocialLoginButtons portal="employer" action={m.account_social_action_login()} appearance="employer" />
      </div>

      <div className="login-field mb-5 flex items-center gap-3">
        <div className="divider-line" />
        <span className="shrink-0 text-xs font-medium uppercase tracking-widest text-gray-400">
          {m.employer_account_login_or_email()}
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
          {m.employer_account_login_no_account()}{' '}
          <Link
            to={employerAppPath('/register')}
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
