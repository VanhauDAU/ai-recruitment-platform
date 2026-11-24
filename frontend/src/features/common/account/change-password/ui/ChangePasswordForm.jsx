import {
  ExclamationCircleFilled,
  LockOutlined,
  MailOutlined,
} from '@ant-design/icons'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Alert, Button, Checkbox, Form, Input, Skeleton } from 'antd'
import { useState } from 'react'
import { useNavigate } from 'react-router'
import { useSession } from '@/entities/account/session'
import { getApiErrorMessage } from '@/shared/api/error-mapper'
import { setTokens } from '@/shared/api/token-store'
import { message } from '@/shared/lib/toast'
import { changeCurrentPassword, getPasswordSetupRequirements } from '../api/change-password.api'
import { m } from '@/shared/config/i18n'

const PROVIDER_LABELS = { google: 'Google', facebook: 'Facebook', linkedin: 'LinkedIn' }

const PASSWORD_CHECKS = [
  { label: m.account_password_check_length(), test: (value) => value.length >= 8 && value.length <= 25 },
  { label: m.account_password_check_case(), test: (value) => /[a-z]/.test(value) && /[A-Z]/.test(value) },
  { label: m.account_password_check_digit(), test: (value) => /\d/.test(value) },
]

function validateNewPassword(_, value) {
  if (!value) return Promise.resolve()
  if (value.length < 8 || value.length > 25) {
    return Promise.reject(new Error(m.account_password_error_length()))
  }
  if (!/[a-z]/.test(value) || !/[A-Z]/.test(value) || !/\d/.test(value)) {
    return Promise.reject(new Error(m.account_password_error_complexity()))
  }
  return Promise.resolve()
}

function PasswordStrengthGuide({ value }) {
  const passed = PASSWORD_CHECKS.filter((check) => check.test(value)).length
  const label = passed === PASSWORD_CHECKS.length
    ? m.account_password_strength_ok()
    : passed >= 2
      ? m.account_password_strength_almost()
      : m.account_password_strength_weak()
  const color = passed === PASSWORD_CHECKS.length ? 'bg-emerald-500' : passed >= 2 ? 'bg-amber-400' : 'bg-red-400'

  return (
    <div className="absolute left-0 right-0 top-[72px] z-20 rounded-xl bg-white p-4 shadow-xl ring-1 ring-slate-900/10">
      <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-2">
        <div className="flex items-center gap-2 text-xs font-bold text-slate-700 sm:text-sm">
          <ExclamationCircleFilled className={passed === PASSWORD_CHECKS.length ? 'text-emerald-500' : 'text-red-500'} />
          <span>{label}</span>
        </div>
        <span className="text-[11px] font-semibold text-slate-400">{passed}/{PASSWORD_CHECKS.length}</span>
      </div>
      <div className="mt-2.5 flex gap-1.5" aria-label={m.account_password_strength_aria({ passed, total: PASSWORD_CHECKS.length })}>
        {PASSWORD_CHECKS.map((check, index) => (
          <span key={check.label} className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${index < passed ? color : 'bg-slate-100'}`} />
        ))}
      </div>
      <ul className="mt-3 space-y-1.5 text-xs text-slate-600">
        {PASSWORD_CHECKS.map((check) => {
          const valid = check.test(value)
          return (
            <li key={check.label} className={`flex items-center gap-2 ${valid ? 'font-medium text-emerald-600' : 'text-slate-500'}`}>
              <span className={`flex h-4 w-4 items-center justify-center rounded-full text-[10px] font-bold ${valid ? 'bg-emerald-500 text-white' : 'border border-slate-300 bg-slate-50 text-slate-400'}`}>
                {valid ? '✓' : '•'}
              </span>
              {check.label}
            </li>
          )
        })}
      </ul>
    </div>
  )
}

/**
 * Form đặt/đổi mật khẩu dùng chung hai cổng.
 *
 * `onReauth(provider)` do page truyền: tài khoản OAuth chưa có mật khẩu phải
 * xác thực lại với provider trước khi đặt mật khẩu lần đầu (không có mật khẩu
 * hiện tại để đối chiếu). Page sở hữu URL OAuth và đường quay lại của cổng.
 */
export default function ChangePasswordForm({
  defaultLogoutAllSessions = false,
  successRedirect,
  onReauth,
  onSuccess,
  showEmail = false,
}) {
  const { user, setCurrentUser } = useSession()
  const navigate = useNavigate()
  const [form] = Form.useForm()
  const hasPassword = Boolean(user?.has_usable_password)
  const passwordValue = Form.useWatch('password', form) || ''
  const [passwordFocused, setPasswordFocused] = useState(false)
  // Provider trả kèm 403 — chỉ dùng khi phiên hết hạn ngay giữa lúc điền form.
  const [reauthFromError, setReauthFromError] = useState(null)
  // Hỏi trước khi người dùng điền form; chỉ tài khoản chưa có mật khẩu mới vướng.
  const requirements = useQuery({
    queryKey: ['change-password', 'requirements'],
    queryFn: getPasswordSetupRequirements,
    enabled: !hasPassword,
    staleTime: 0,
  })
  const needsReauth = reauthFromError !== null || requirements.data?.requires_reauth === true
  const reauthProvider = requirements.data?.reauth_provider || reauthFromError || null
  const providerLabel = PROVIDER_LABELS[reauthProvider] || m.account_password_social_fallback()
  const reauthMinutes = Math.max(
    1,
    Math.round((requirements.data?.reauth_max_age_seconds || 300) / 60),
  )
  const mutation = useMutation({
    mutationFn: changeCurrentPassword,
    onSuccess: (result) => {
      // Thay access token trong memory; backend đã xoay refresh cookie và `sid`.
      if (result.tokens) setTokens(result.tokens)
      if (result.user) setCurrentUser(result.user)
      message.success(result.detail || m.account_password_updated())
      form.resetFields()
      onSuccess?.(result)
      if (successRedirect) navigate(successRedirect, { replace: true })
    },
    onError: (error) => {
      if (error.response?.data?.code === 'reauth_required') {
        setReauthFromError(error.response.data.reauth_provider || '')
        return
      }
      const fields = error.response?.data && typeof error.response.data === 'object'
        ? Object.entries(error.response.data)
          .filter(([name]) => ['current_password', 'password'].includes(name))
          .map(([name, errors]) => ({ name, errors: Array.isArray(errors) ? errors.map(String) : [String(errors)] }))
        : []
      if (fields.length) form.setFields(fields)
      else message.error(getApiErrorMessage(error, m.account_password_update_failed()))
    },
  })

  function submit(values) {
    setReauthFromError(null)
    mutation.mutate({
      current_password: values.current_password || '',
      password: values.password,
      logout_all_sessions: Boolean(values.logout_all_sessions),
    })
  }

  return (
    <div className="w-full">
      {!hasPassword && requirements.isPending && (
        <Skeleton active title={false} paragraph={{ rows: 2 }} className="!mb-4" />
      )}
      {needsReauth && (
        <Alert
          type="warning"
          showIcon
          className="!mb-5 rounded-xl border-amber-200 bg-amber-50/70"
          title={m.account_password_reauth_title({ provider: providerLabel })}
          description={
            reauthProvider
              ? m.account_password_reauth_desc({ provider: providerLabel, minutes: reauthMinutes })
              : m.account_password_no_social_desc()
          }
          action={
            reauthProvider && onReauth ? (
              <Button type="primary" onClick={() => onReauth(reauthProvider)} className="!rounded-lg !bg-amber-600 hover:!bg-amber-700 !border-amber-600">
                {m.account_password_reauth_button({ provider: providerLabel })}
              </Button>
            ) : null
          }
        />
      )}
      {!hasPassword && !needsReauth && !requirements.isPending && (
        <Alert
          type="info"
          showIcon
          className="!mb-5 rounded-xl border-sky-200 bg-sky-50/70"
          title={m.account_password_no_password_title()}
          description={m.account_password_no_password_desc()}
        />
      )}
      <Form
        form={form}
        layout="vertical"
        colon={false}
        requiredMark={false}
        onFinish={submit}
        initialValues={{ logout_all_sessions: defaultLogoutAllSessions }}
        className="p-0 [&_.ant-form-item]:!mb-4 [&_.ant-form-item-label]:!pb-1.5 [&_.ant-form-item-label>label]:!text-sm [&_.ant-form-item-label>label]:!font-medium [&_.ant-form-item-label>label]:!text-slate-700"
      >
        {showEmail && (
          <Form.Item label={m.account_password_login_email()}>
            <Input
              aria-label={m.account_password_login_email()}
              autoComplete="username"
              value={user?.email || ''}
              readOnly
              prefix={<MailOutlined className="mr-1.5 text-slate-400" />}
              className="!h-10 !rounded-lg !bg-slate-50 !text-slate-600 border-slate-200"
            />
          </Form.Item>
        )}
        {hasPassword && (
          <Form.Item
            name="current_password"
            label={(
              <span>
                {m.account_password_current()}
                <span className="mr-1 font-bold text-red-500"> *</span>
              </span>
            )}
            rules={[{ required: true, message: m.account_password_current_required() }]}
          >
            <Input.Password
              aria-label={m.account_password_current()}
              size="middle"
              autoComplete="current-password"
              placeholder={m.account_password_current_required()}
              prefix={<LockOutlined className="mr-1.5 text-slate-400" />}
              className="!h-10 !rounded-lg"
            />
          </Form.Item>
        )}
        <div className="relative">
          <Form.Item
            name="password"
            label={(
              <span>
                {m.account_password_new()}
                <span className="mr-1 font-bold text-red-500"> *</span>
              </span>
            )}
            rules={[
              { required: true, message: m.account_password_new_required() },
              { validator: validateNewPassword },
            ]}
          >
            <Input.Password
              aria-label={m.account_password_new()}
              size="middle"
              autoComplete="new-password"
              prefix={<LockOutlined className="mr-1.5 text-slate-400" />}
              placeholder={m.account_password_new_required()}
              className="!h-10 !rounded-lg"
              onFocus={() => setPasswordFocused(true)}
              onBlur={() => setPasswordFocused(false)}
            />
          </Form.Item>
          {passwordFocused && <PasswordStrengthGuide value={passwordValue} />}
        </div>
        <Form.Item
          name="confirm_password"
          label={(
            <span>
              {m.account_password_confirm()}
              <span className="mr-1 font-bold text-red-500"> *</span>
            </span>
          )}
          dependencies={['password']}
          rules={[
            { required: true, message: m.account_password_confirm() },
            ({ getFieldValue }) => ({
              validator: (_, value) => !value || value === getFieldValue('password')
                ? Promise.resolve()
                : Promise.reject(new Error(m.account_password_mismatch())),
            }),
          ]}
        >
          <Input.Password
            aria-label={m.account_password_confirm()}
            size="middle"
            autoComplete="new-password"
            placeholder={m.account_password_confirm()}
            prefix={<LockOutlined className="mr-1.5 text-slate-400" />}
            className="!h-10 !rounded-lg"
          />
        </Form.Item>
        <Form.Item name="logout_all_sessions" valuePropName="checked" className="!mb-6">
          <Checkbox className="text-sm text-slate-700">{m.account_password_logout_others()}</Checkbox>
        </Form.Item>
        <div className="mt-6 flex items-center gap-3">
          <Button
            type="primary"
            htmlType="submit"
            size="middle"
            loading={mutation.isPending}
            disabled={needsReauth}
            className="!h-10 min-w-28 !rounded-lg !bg-[var(--brand-primary)] font-semibold text-white shadow-sm hover:!bg-[var(--brand-primary-hover)] !border-[var(--brand-primary)]"
          >
            {hasPassword ? m.account_password_submit_update() : m.account_password_submit_create()}
          </Button>
          <Button
            htmlType="button"
            size="middle"
            onClick={() => form.resetFields()}
            className="!h-10 min-w-24 !rounded-lg border-slate-300 font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-800"
          >
            {m.account_password_cancel()}
          </Button>
        </div>
      </Form>
    </div>
  )
}
