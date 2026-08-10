import { LockOutlined, MailOutlined } from '@ant-design/icons'
import { Alert, Form, Input } from 'antd'
import { useEffect, useRef, useState } from 'react'
import { useGoogleReCaptcha } from 'react-google-recaptcha-v3'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router'
import { getApiErrorMessage, getOAuthErrorMessage } from '@/shared/api/error-mapper'
import { toastSoundOptions } from '@/shared/lib/sound-effects'
import { message } from '@/shared/lib/toast'
import { MAIN_FORGOT_PASSWORD_URL } from '@/shared/config/portals'
import { useSession } from '@/entities/session'
import { login, resendTwoFactorLogin, verifyTwoFactorLogin } from '../api/auth.api'
import TwoFactorCodeModal from '@/shared/ui/TwoFactorCodeModal'
import { getReturnUrl } from '../model/return-url'
import { getAuthDestination } from '../model/password-login-destination'
import AuthFormStyles from './AuthFormStyles'
import AuthMascot from './AuthMascot'
import LoginSubmitButton from './LoginSubmitButton'

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
  const [twoFactorChallenge, setTwoFactorChallenge] = useState(null)
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
      setError('Captcha chưa sẵn sàng, vui lòng thử lại.')
      return
    }
    submitLockedRef.current = true
    setValidationFailed(false)
    setActiveMascotField(null)
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
      message.success('Đăng nhập thành công.', toastSoundOptions('done'))
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
      submitLockedRef.current = false
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
    message.success('Đăng nhập thành công.', toastSoundOptions('done'))
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
              { required: true, message: 'Vui lòng nhập email' },
              { type: 'email', message: 'Email không hợp lệ' },
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
            {!forgotPasswordLink && passwordHelp}
          </div>
          <Form.Item
            name="password"
            id="login_password"
            rules={[{ required: true, message: 'Vui lòng nhập mật khẩu' }]}
            className="!mb-4"
          >
            <Input.Password
              size="large"
              disabled={loading}
              autoComplete="current-password"
              prefix={<LockOutlined className="text-[var(--brand-primary)]" />}
              placeholder="Nhập mật khẩu của bạn"
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
