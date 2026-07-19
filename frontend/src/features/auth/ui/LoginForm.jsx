import { ArrowRightOutlined, LockOutlined, MailOutlined } from '@ant-design/icons'
import { Alert, Form, Input, message } from 'antd'
import { useEffect, useState } from 'react'
import { useGoogleReCaptcha } from 'react-google-recaptcha-v3'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { getApiErrorMessage, getOAuthErrorMessage } from '@/shared/api/error-mapper'
import { MAIN_FORGOT_PASSWORD_URL } from '@/shared/config/portals'
import { useSession } from '@/entities/session'
import { login, resendTwoFactorLogin, verifyTwoFactorLogin } from '../api/auth.api'
import TwoFactorCodeModal from '@/shared/ui/TwoFactorCodeModal'
import { getReturnUrl } from '../model/return-url'
import { getAuthDestination } from '../model/password-login-destination'

// Style animation/nút dùng chung cho các trang auth (login + register các cổng).
export function AuthFormStyles() {
  return (
    <style>{`
      @keyframes fadeSlideUp {
        from { opacity: 0; transform: translateY(18px); }
        to   { opacity: 1; transform: translateY(0); }
      }
      @keyframes fadeIn {
        from { opacity: 0; }
        to   { opacity: 1; }
      }
      .login-card { animation: fadeSlideUp 0.45s cubic-bezier(0.22,1,0.36,1) both; }
      .login-field { animation: fadeSlideUp 0.45s cubic-bezier(0.22,1,0.36,1) both; }
      .login-field:nth-child(1) { animation-delay: 0.05s; }
      .login-field:nth-child(2) { animation-delay: 0.1s; }
      .login-field:nth-child(3) { animation-delay: 0.15s; }
      .login-field:nth-child(4) { animation-delay: 0.2s; }
      .social-btn { transition: all 0.18s ease; }
      .social-btn:hover { transform: translateY(-2px); box-shadow: 0 4px 16px rgba(0,0,0,0.08); }
      .submit-btn {
        position: relative; overflow: hidden;
        background: linear-gradient(135deg, var(--brand-primary) 0%, var(--brand-primary-hover) 100%);
        transition: all 0.2s ease;
      }
      .submit-btn:hover { transform: translateY(-1px); box-shadow: 0 8px 24px rgba(0,177,79,0.35); }
      .submit-btn:active { transform: translateY(0); }
      .submit-btn::after {
        content: ''; position: absolute; inset: 0;
        background: linear-gradient(135deg, rgba(255,255,255,0.12) 0%, transparent 60%);
        pointer-events: none;
      }
      .divider-line { flex: 1; height: 1px; background: linear-gradient(to right, transparent, #e5e7eb, transparent); }
    `}</style>
  )
}

/**
 * Form đăng nhập dùng chung cho 3 cổng (main / tuyendung / admin).
 * - `portal`: gửi kèm payload để backend chặn sai role trước khi phát token.
 * - `expectedRoles`: fallback check phía client — sai role thì logout + báo lỗi.
 * - `forgotPasswordLink`: null để ẩn (cổng admin).
 * - `onSuccess`: nếu truyền (vd. nhúng trong modal), gọi callback thay vì điều hướng.
 */
export default function LoginForm({ portal, expectedRoles, onSuccess, forgotPasswordLink = MAIN_FORGOT_PASSWORD_URL, appearance = 'default' }) {
  // Cổng NTD/admin chạy subdomain riêng -> link tuyệt đối, không đi qua router.
  const ForgotLink = forgotPasswordLink?.startsWith('http') ? 'a' : Link
  const forgotLinkProps = forgotPasswordLink?.startsWith('http')
    ? { href: forgotPasswordLink }
    : { to: forgotPasswordLink }
  const { logout, refreshSession } = useSession()
  const navigate = useNavigate()
  const location = useLocation()
  const { executeRecaptcha } = useGoogleReCaptcha()
  const [searchParams] = useSearchParams()
  // Lỗi từ luồng social login (OAuthCallback quay về kèm ?oauth_error=).
  const [error, setError] = useState(() => getOAuthErrorMessage(searchParams.get('oauth_error')))
  const [warning, setWarning] = useState(() => location.state?.authWarning || '')
  const [loading, setLoading] = useState(false)
  const [twoFactorChallenge, setTwoFactorChallenge] = useState(null)
  const [form] = Form.useForm()
  const returnUrl = getReturnUrl(searchParams)
  const employerAppearance = appearance === 'employer'

  function navigateAfterLogin(user) {
    navigate(getAuthDestination({ user, returnUrl }), { replace: true })
  }

  function clearPassword() {
    form.resetFields(['password'])
  }

  useEffect(() => {
    if (!searchParams.has('oauth_error')) return
    const nextParams = new URLSearchParams(searchParams)
    nextParams.delete('oauth_error')
    navigate(
      { search: nextParams.toString() ? `?${nextParams.toString()}` : '' },
      { replace: true },
    )
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function onFinish(values) {
    if (!executeRecaptcha) {
      clearPassword()
      setError('Captcha chưa sẵn sàng, vui lòng thử lại.')
      return
    }
    setError('')
    setLoading(true)
    try {
      const captchaToken = await executeRecaptcha('login')
      const result = await login({ ...values, captcha_token: captchaToken, portal })
      if (result.two_factor_required) {
        clearPassword()
        setTwoFactorChallenge({ ...result, portal, method: result.preferred_method || 'email' })
        return
      }
      const user = await refreshSession()
      if (expectedRoles && !expectedRoles.includes(user.role)) {
        clearPassword()
        logout()
        setError('Tài khoản không có quyền truy cập cổng này.')
        return
      }
      message.success('Đăng nhập thành công.')
      if (onSuccess) onSuccess(user)
      else navigateAfterLogin(user)
    } catch (err) {
      clearPassword()
      if (err.response?.status === 429) {
        setError('Bạn thao tác quá nhanh, vui lòng thử lại sau ít phút.')
      } else {
        setError(getApiErrorMessage(err, 'Email hoặc mật khẩu không đúng. Vui lòng thử lại.'))
      }
    } finally {
      setLoading(false)
    }
  }

  async function handleTwoFactorConfirm(code) {
    await verifyTwoFactorLogin({
      challenge: twoFactorChallenge.challenge,
      code,
      method: twoFactorChallenge.method,
      portal: twoFactorChallenge.portal,
    })
    const user = await refreshSession()
    if (expectedRoles && !expectedRoles.includes(user.role)) {
      logout()
      setTwoFactorChallenge(null)
      setError('Tài khoản không có quyền truy cập cổng này.')
      return
    }
    setTwoFactorChallenge(null)
    message.success('Đăng nhập thành công.')
    if (onSuccess) onSuccess(user)
    else navigateAfterLogin(user)
  }

  return (
    <>
      <AuthFormStyles />

      {error && (
        <Alert
          type="error"
          message={error}
          showIcon
          className="mb-4 !rounded-xl login-field"
          closable
          onClose={() => setError('')}
        />
      )}
      {warning && (
        <Alert
          type="warning"
          message={warning}
          showIcon
          closable
          className="mb-4 !rounded-xl login-field"
          onClose={() => setWarning('')}
        />
      )}

      <Form form={form} layout="vertical" onFinish={onFinish} onFinishFailed={clearPassword} requiredMark={false} className="space-y-0">
        <div className="login-field">
          <Form.Item
            name="email"
            label={<span className="text-sm font-semibold text-gray-700 dark:text-gray-300">Email</span>}
            rules={[
              { required: true, message: 'Vui lòng nhập email' },
              { type: 'email', message: 'Email không hợp lệ' },
            ]}
          >
            <Input
              size="large"
              autoComplete="email"
              prefix={<MailOutlined className="text-[var(--brand-primary)]" />}
              placeholder="ten@congty.com"
              className={`${employerAppearance ? '!rounded-lg !h-12' : '!rounded-full !h-11'} !text-base`}
            />
          </Form.Item>
        </div>

        <div className="login-field">
          {/* Label row: tách khỏi Form.Item để justify-between hoạt động đúng */}
          <div className="flex items-center justify-between mb-1.5">
            <label
              htmlFor="login_password"
              className="text-sm font-semibold text-gray-700 dark:text-gray-300 cursor-default"
            >
              Mật khẩu
            </label>
            {forgotPasswordLink && (
              <ForgotLink
                {...forgotLinkProps}
                className="text-xs font-medium text-[var(--brand-primary)] hover:text-[var(--brand-primary-hover)] hover:underline underline-offset-2 transition-colors"
                tabIndex={-1}
              >
                Quên mật khẩu?
              </ForgotLink>
            )}
          </div>
          <Form.Item
            name="password"
            id="login_password"
            rules={[{ required: true, message: 'Vui lòng nhập mật khẩu' }]}
            className="!mb-4"
          >
            <Input.Password
              size="large"
              autoComplete="current-password"
              prefix={<LockOutlined className="text-[var(--brand-primary)]" />}
              placeholder="Nhập mật khẩu của bạn"
              className={`${employerAppearance ? '!rounded-lg !h-12' : '!rounded-full !h-11'} !text-base`}
            />
          </Form.Item>
        </div>

        <div className="login-field pt-1">
          <button
            type="submit"
            disabled={loading}
            className={`submit-btn w-full flex items-center justify-center gap-2.5 px-6 py-3.5 text-base font-bold text-white cursor-pointer disabled:opacity-70 disabled:cursor-not-allowed ${employerAppearance ? 'rounded-lg' : 'rounded-full'}`}
          >
            {loading ? (
              <>
                <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="white" strokeWidth="4"/>
                  <path className="opacity-75" fill="white" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                </svg>
                Đang đăng nhập...
              </>
            ) : (
              <>
                Đăng nhập
                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-white/20">
                  <ArrowRightOutlined className="text-xs" />
                </span>
              </>
            )}
          </button>
        </div>
      </Form>

      <TwoFactorCodeModal
        open={Boolean(twoFactorChallenge)}
        email={twoFactorChallenge?.email}
        expiresIn={twoFactorChallenge?.expires_in || 180}
        onCancel={() => setTwoFactorChallenge(null)}
        onConfirm={handleTwoFactorConfirm}
        onResend={() => resendTwoFactorLogin(twoFactorChallenge.challenge)}
        codeLength={twoFactorChallenge?.method === 'backup' ? 8 : 6}
        title={twoFactorChallenge?.method === 'totp' ? 'Nhập mã ứng dụng xác thực' : twoFactorChallenge?.method === 'backup' ? 'Nhập mã dự phòng' : undefined}
        description={twoFactorChallenge?.method === 'totp'
          ? 'Mở ứng dụng xác thực của bạn và nhập mã gồm 6 chữ số.'
          : twoFactorChallenge?.method === 'backup'
            ? 'Nhập một mã dự phòng gồm 8 chữ số. Mỗi mã chỉ sử dụng một lần.'
            : undefined}
        showResend={twoFactorChallenge?.method === 'email'}
        methodOptions={twoFactorChallenge && Object.values(twoFactorChallenge.methods || { email: true }).filter(Boolean).length > 1 ? (
          <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-3 text-left">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Phương thức khác</p>
            <div className="flex gap-2">
              {twoFactorChallenge.methods?.totp && twoFactorChallenge.method !== 'totp' && <button type="button" className="flex-1 whitespace-nowrap rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-600 transition hover:border-emerald-300 hover:text-emerald-700" onClick={() => setTwoFactorChallenge((current) => ({ ...current, method: 'totp' }))}>Ứng dụng xác thực</button>}
              {twoFactorChallenge.methods?.email && twoFactorChallenge.method !== 'email' && <button type="button" className="flex-1 whitespace-nowrap rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-600 transition hover:border-emerald-300 hover:text-emerald-700" onClick={() => setTwoFactorChallenge((current) => ({ ...current, method: 'email' }))}>Nhận mã qua email</button>}
              {twoFactorChallenge.methods?.backup && twoFactorChallenge.method !== 'backup' && <button type="button" className="flex-1 whitespace-nowrap rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-600 transition hover:border-emerald-300 hover:text-emerald-700" onClick={() => setTwoFactorChallenge((current) => ({ ...current, method: 'backup' }))}>Dùng mã dự phòng</button>}
            </div>
          </div>
        ) : null}
      />
    </>
  )
}
