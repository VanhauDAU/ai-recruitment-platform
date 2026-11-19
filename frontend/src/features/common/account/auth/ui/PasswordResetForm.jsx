import { CheckCircleFilled, CloseCircleFilled, LockOutlined, SafetyCertificateOutlined } from '@ant-design/icons'
import { Alert, Form, Input, Spin } from 'antd'
import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { getApiErrorMessage } from '@/shared/api/error-mapper'
import { adminPath, EMPLOYER_LOGIN_URL, MAIN_LOGIN_URL } from '@/shared/config/portals'
import { confirmPasswordReset, validatePasswordResetToken } from '../api/auth.api'
import { passwordValidationRule } from './password-validation'
import AuthLogo from './AuthLogo'
import { AuthFormStyles } from './LoginForm'
import PasswordRequirements from './PasswordRequirements'
import { m } from '@/shared/config/i18n'

const LOGIN_URL_BY_ROLE = {
  employer: EMPLOYER_LOGIN_URL,
  admin: adminPath('/login'),
}
const loginUrlFor = (role) => LOGIN_URL_BY_ROLE[role] || MAIN_LOGIN_URL

/** Shared reset form; only the Admin route supplies the protected portal binding. */
export default function PasswordResetForm({
  portal,
  requestPath = '/forgot-password',
  invalidActionLabel = m.account_reset_resend_link(),
}) {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const token = params.get('token')
  const isAdminReset = portal === 'admin'

  const [checking, setChecking] = useState(true)
  const [account, setAccount] = useState(null)
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(null)

  useEffect(() => {
    if (!token) {
      setChecking(false)
      return
    }
    validatePasswordResetToken(token, { portal })
      .then(setAccount)
      .catch(() => setAccount(null))
      .finally(() => setChecking(false))
  }, [portal, token])

  async function onFinish(values) {
    setError('')
    setLoading(true)
    try {
      const res = await confirmPasswordReset({ token, password: values.password, portal })
      setDone(loginUrlFor(res.role))
    } catch (err) {
      const data = err.response?.data
      setError(data?.password?.[0] || getApiErrorMessage(err, m.account_reset_failed()))
    } finally {
      setLoading(false)
    }
  }

  if (checking) {
    return <div className="flex w-full justify-center py-10"><Spin size="large" /></div>
  }

  if (done) {
    return (
      <div className="w-full text-center">
        <AuthFormStyles />
        <div className="login-card">
          <CheckCircleFilled className="text-5xl" style={{ color: 'var(--brand-primary)' }} />
          <h2 className="mt-4 text-xl font-bold text-gray-900 dark:text-white">{m.account_reset_done_title()}</h2>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
            {isAdminReset
              ? m.account_reset_done_admin()
              : m.account_reset_done_default()}
          </p>
          <button
            type="button"
            onClick={() => (done.startsWith('http') ? window.location.assign(done) : navigate(done))}
            className="submit-btn mt-6 w-full cursor-pointer rounded-full px-6 py-3.5 text-base font-bold text-white"
          >
            {m.account_reset_login_now()}
          </button>
        </div>
      </div>
    )
  }

  if (!token || !account) {
    return (
      <div className="w-full text-center">
        <AuthFormStyles />
        <div className="login-card">
          <CloseCircleFilled className="text-5xl text-red-500" />
          <h2 className="mt-4 text-xl font-bold text-gray-900 dark:text-white">{m.account_reset_invalid_title()}</h2>
          <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-gray-600 dark:text-gray-300">
            {m.account_reset_invalid_desc()}
          </p>
          <Link to={requestPath} className="mt-6 inline-block">
            <span className="submit-btn inline-block cursor-pointer rounded-full px-8 py-3 text-base font-bold text-white">
              {invalidActionLabel}
            </span>
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full">
      <AuthFormStyles />
      <div className="login-card mb-7 text-center">
        {isAdminReset
          ? <SafetyCertificateOutlined className="mb-3 text-4xl text-[var(--brand-primary)]" />
          : <AuthLogo className="mb-3" />}
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">
          {isAdminReset ? m.account_reset_title_admin() : m.account_reset_title()}
        </h2>
        <p className="mt-1.5 text-sm text-gray-500 dark:text-gray-400">
          {m.account_reset_for_account()}<strong className="text-gray-700 dark:text-gray-300">{account.email}</strong>
        </p>
      </div>

      {error && (
        <Alert type="error" message={error} showIcon closable onClose={() => setError('')} className="login-field mb-4 !rounded-xl" />
      )}

      <Form layout="vertical" onFinish={onFinish} requiredMark={false}>
        <div className="login-field">
          <Form.Item
            name="password"
            label={<span className="text-sm font-semibold text-gray-700 dark:text-gray-300">{m.account_password_new()}</span>}
            rules={[{ required: true, message: m.account_auth_password_required() }, { validator: passwordValidationRule }]}
          >
            <Input.Password
              size="large"
              autoComplete="new-password"
              autoFocus
              onChange={(event) => setPassword(event.target.value)}
              prefix={<LockOutlined className="text-[var(--brand-primary)]" />}
              placeholder={m.account_password_new_required()}
              className="!h-11 !rounded-full !text-base"
            />
          </Form.Item>
          <PasswordRequirements password={password} />
        </div>

        <div className="login-field">
          <Form.Item
            name="confirm"
            dependencies={['password']}
            label={<span className="text-sm font-semibold text-gray-700 dark:text-gray-300">{m.account_auth_confirm_password()}</span>}
            rules={[
              { required: true, message: m.account_auth_confirm_password_required() },
              ({ getFieldValue }) => ({
                validator: (_, value) => (!value || getFieldValue('password') === value
                  ? Promise.resolve()
                  : Promise.reject(new Error(m.account_password_mismatch()))),
              }),
            ]}
          >
            <Input.Password
              size="large"
              autoComplete="new-password"
              prefix={<LockOutlined className="text-[var(--brand-primary)]" />}
              placeholder={m.account_password_confirm()}
              className="!h-11 !rounded-full !text-base"
            />
          </Form.Item>
        </div>

        <div className="login-field pt-1">
          <button
            type="submit"
            disabled={loading}
            className="submit-btn w-full cursor-pointer rounded-full px-6 py-3.5 text-base font-bold text-white disabled:cursor-not-allowed disabled:opacity-70"
          >
            {loading ? m.account_reset_submitting() : m.account_reset_submit()}
          </button>
        </div>
      </Form>
    </div>
  )
}
