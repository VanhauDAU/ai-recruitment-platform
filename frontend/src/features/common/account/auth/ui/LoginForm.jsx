import { LockOutlined, MailOutlined } from '@ant-design/icons'
import { Alert, Form, Input } from 'antd'
import { useEffect, useRef, useState } from 'react'
import { useGoogleReCaptcha } from 'react-google-recaptcha-v3'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router'
import { getApiErrorMessage, getOAuthErrorMessage } from '@/shared/api/error-mapper'
import { toastSoundOptions } from '@/shared/lib/sound-effects'
import { message } from '@/shared/lib/toast'
import { MAIN_FORGOT_PASSWORD_URL } from '@/shared/config/portals'
import { useSession } from '@/entities/account/session'
import { login } from '../api/auth.api'
import { getReturnUrl } from '../model/return-url'
import { getAuthDestination } from '../model/password-login-destination'
import AuthFormStyles from './AuthFormStyles'
import AuthMascot from './AuthMascot'
import LoginSubmitButton from './LoginSubmitButton'
import { m } from '@/shared/config/i18n'

export { AuthFormStyles }

/**
 * Form đăng nhập dùng chung cho 3 cổng (main / tuyendung / admin).
 * - `portal`: gửi kèm payload để backend chặn sai role trước khi phát token.
 * - `expectedRoles`: fallback check phía client — sai role thì logout + báo lỗi.
 * - `forgotPasswordLink`: null để ẩn (cổng admin).
 * - `passwordHelp`: hướng dẫn thay thế ở hàng nhãn mật khẩu khi không có link.
 * - `onSuccess`: nếu truyền (vd. nhúng trong modal), gọi callback thay vì điều hướng.
 */
export default function LoginForm({
  portal,
  expectedRoles,
  onSuccess,
  forgotPasswordLink = MAIN_FORGOT_PASSWORD_URL,
  passwordHelp = null,
  withMascot = false,
  appearance = 'default',
  destinationResolver = (user, returnUrl) => getAuthDestination({ user, returnUrl }),
}) {
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
  const [activeMascotField, setActiveMascotField] = useState(null)
  const [passwordVisible, setPasswordVisible] = useState(false)
  const [validationFailed, setValidationFailed] = useState(false)
  const submitLockedRef = useRef(false)
  const [form] = Form.useForm()
  const emailValue = Form.useWatch('email', form) || ''
  const passwordValue = Form.useWatch('password', form) || ''
  const returnUrl = getReturnUrl(searchParams)
  const employerAppearance = appearance === 'employer'
  const credentialsReady = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailValue.trim()) && passwordValue.length > 0

  function navigateAfterLogin(user) {
    navigate(destinationResolver(user, returnUrl), { replace: true })
  }

  function clearPassword() {
    form.resetFields(['password'])
  }

  function focusMascotField(field) {
    setValidationFailed(false)
    setActiveMascotField(field)
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
    // React state có thể chưa render kịp giữa hai click/Enter liên tiếp. Ref này
    // khóa đồng bộ trong cùng event loop để chỉ phát đúng một request đăng nhập.
    if (submitLockedRef.current) return
    if (!executeRecaptcha) {
      clearPassword()
      setError(m.account_auth_captcha_not_ready())
      return
    }
    submitLockedRef.current = true
    setValidationFailed(false)
    setActiveMascotField(null)
    setError('')
    setLoading(true)
    try {
      const captchaToken = await executeRecaptcha('login')
      await login({ ...values, captcha_token: captchaToken, portal })
      const user = await refreshSession()
      if (expectedRoles && !expectedRoles.includes(user.role)) {
        clearPassword()
        logout()
        setError(m.account_auth_wrong_portal())
        return
      }
      message.success(m.account_auth_login_success(), toastSoundOptions('done'))
      if (onSuccess) onSuccess(user)
      else navigateAfterLogin(user)
    } catch (err) {
      clearPassword()
      if (err.response?.status === 429) {
        setError(m.account_auth_rate_limited())
      } else {
        setError(getApiErrorMessage(err, m.account_auth_invalid_credentials()))
      }
    } finally {
      submitLockedRef.current = false
      setLoading(false)
    }
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

      {withMascot && (
        <AuthMascot
          activeField={activeMascotField}
          error={Boolean(error)}
          invalid={validationFailed}
          loading={loading}
          passwordVisible={passwordVisible}
          success={credentialsReady}
        />
      )}

      <Form
        form={form}
        layout="vertical"
        onFinish={onFinish}
        onFinishFailed={() => {
          clearPassword()
          setActiveMascotField(null)
          setValidationFailed(true)
        }}
        requiredMark={false}
        className="space-y-0"
      >
        <div className="login-field">
          <Form.Item
            name="email"
            label={<span className="text-sm font-semibold text-gray-700 dark:text-gray-300">Email</span>}
            rules={[
              { required: true, message: m.account_auth_email_required() },
              { type: 'email', message: m.account_auth_email_invalid() },
            ]}
          >
            <Input
              size="large"
              disabled={loading}
              autoComplete="email"
              prefix={<MailOutlined className="text-[var(--brand-primary)]" />}
              placeholder="ten@congty.com"
              onFocus={() => focusMascotField('email')}
              onBlur={() => setActiveMascotField(null)}
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
              {m.account_auth_password()}
            </label>
            {forgotPasswordLink && (
              <ForgotLink
                {...forgotLinkProps}
                className="text-xs font-medium text-[var(--brand-primary)] hover:text-[var(--brand-primary-hover)] hover:underline underline-offset-2 transition-colors"
                tabIndex={-1}
              >
                {m.account_auth_forgot_password()}
              </ForgotLink>
            )}
            {!forgotPasswordLink && passwordHelp}
          </div>
          <Form.Item
            name="password"
            id="login_password"
            rules={[{ required: true, message: m.account_auth_password_required() }]}
            className="!mb-4"
          >
            <Input.Password
              size="large"
              disabled={loading}
              autoComplete="current-password"
              prefix={<LockOutlined className="text-[var(--brand-primary)]" />}
              placeholder={m.account_auth_password_placeholder()}
              onFocus={() => focusMascotField('password')}
              onBlur={() => setActiveMascotField(null)}
              visibilityToggle={{
                visible: passwordVisible,
                onVisibleChange: (visible) => {
                  setPasswordVisible(visible)
                  focusMascotField('password')
                },
              }}
              className={`${employerAppearance ? '!rounded-lg !h-12' : '!rounded-full !h-11'} !text-base`}
            />
          </Form.Item>
        </div>

        <div className="login-field pt-1">
          <LoginSubmitButton loading={loading} employerAppearance={employerAppearance} />
        </div>
      </Form>
    </>
  )
}
