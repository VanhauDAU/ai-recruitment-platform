import { ExclamationCircleFilled, LockOutlined } from '@ant-design/icons'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Alert, Button, Checkbox, Form, Input, Skeleton } from 'antd'
import { useState } from 'react'
import { useNavigate } from 'react-router'
import { useSession } from '@/entities/session'
import { getApiErrorMessage } from '@/shared/api/error-mapper'
import { setTokens } from '@/shared/api/token-store'
import { message } from '@/shared/lib/toast'
import { changeCurrentPassword, getPasswordSetupRequirements } from '../api/change-password.api'

const PROVIDER_LABELS = { google: 'Google', facebook: 'Facebook', linkedin: 'LinkedIn' }

const PASSWORD_CHECKS = [
  { label: 'Từ 8 đến 25 ký tự', test: (value) => value.length >= 8 && value.length <= 25 },
  { label: 'Có chữ in hoa và chữ thường', test: (value) => /[a-z]/.test(value) && /[A-Z]/.test(value) },
  { label: 'Có ít nhất 1 số', test: (value) => /\d/.test(value) },
]

function validateNewPassword(_, value) {
  if (!value) return Promise.resolve()
  if (value.length < 8 || value.length > 25) {
    return Promise.reject(new Error('Mật khẩu phải từ 8 đến 25 ký tự'))
  }
  if (!/[a-z]/.test(value) || !/[A-Z]/.test(value) || !/\d/.test(value)) {
    return Promise.reject(new Error('Mật khẩu phải bao gồm chữ hoa, chữ thường và ký tự số'))
  }
  return Promise.resolve()
}

function PasswordStrengthGuide({ value }) {
  const passed = PASSWORD_CHECKS.filter((check) => check.test(value)).length
  const label = passed === PASSWORD_CHECKS.length
    ? 'Đạt yêu cầu cơ bản'
    : passed >= 2
      ? 'Gần đạt yêu cầu'
      : 'Chưa đạt yêu cầu'
  const color = passed === PASSWORD_CHECKS.length ? 'bg-emerald-500' : passed >= 2 ? 'bg-amber-400' : 'bg-red-400'

  return (
    <div className="absolute left-0 right-0 top-[68px] z-20 rounded-lg bg-white p-3 shadow-[0_6px_18px_rgba(15,23,42,.12)] ring-1 ring-slate-100 sm:top-[42px] sm:left-[220px]">
      <div className="flex items-center gap-2 text-sm font-bold text-slate-700">
        <ExclamationCircleFilled className={passed === PASSWORD_CHECKS.length ? 'text-emerald-500' : 'text-red-500'} />
        {label}
      </div>
      <div className="mt-2 flex gap-2" aria-label={`Độ mạnh mật khẩu: ${passed} trên ${PASSWORD_CHECKS.length}`}>
        {PASSWORD_CHECKS.map((check, index) => <span key={check.label} className={`h-1 flex-1 rounded-full ${index < passed ? color : 'bg-slate-200'}`} />)}
      </div>
      <ul className="mt-2 space-y-1.5 text-xs text-slate-600">
        {PASSWORD_CHECKS.map((check) => {
          const valid = check.test(value)
          return <li key={check.label} className={`flex items-center gap-2 ${valid ? 'text-emerald-600' : ''}`}><span className={`h-2 w-2 rounded-full border ${valid ? 'border-emerald-500 bg-emerald-500' : 'border-slate-400'}`} />{check.label}</li>
        })}
      </ul>
      <p className="mt-2 text-[11px] leading-4 text-slate-500">
        Khi lưu, hệ thống còn kiểm tra mật khẩu phổ biến và mức độ tương tự thông tin tài khoản.
      </p>
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
  const providerLabel = PROVIDER_LABELS[reauthProvider] || 'mạng xã hội'
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
      message.success(result.detail || 'Cập nhật mật khẩu thành công.')
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
      else message.error(getApiErrorMessage(error, 'Không thể cập nhật mật khẩu.'))
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
    <div className="max-w-[960px]">
      {!hasPassword && requirements.isPending && (
        <Skeleton active title={false} paragraph={{ rows: 2 }} className="!mb-4" />
      )}
      {needsReauth && (
        <Alert
          type="warning"
          showIcon
          className="!mb-4"
          title={`Xác thực lại với ${providerLabel} để tạo mật khẩu`}
          description={
            reauthProvider
              ? `Tài khoản này đăng nhập bằng ${providerLabel} và chưa có mật khẩu, nên không có mật khẩu hiện tại để đối chiếu. Hãy xác thực lại với ${providerLabel} trong vòng ${reauthMinutes} phút trước khi đặt mật khẩu mới — bạn sẽ được đưa về đúng trang này.`
              : 'Tài khoản này chưa có mật khẩu và cũng chưa liên kết tài khoản mạng xã hội nào. Hãy dùng chức năng “Quên mật khẩu” để đặt mật khẩu qua email.'
          }
          action={
            reauthProvider && onReauth ? (
              <Button type="primary" onClick={() => onReauth(reauthProvider)}>
                Xác thực với {providerLabel}
              </Button>
            ) : null
          }
        />
      )}
      {!hasPassword && !needsReauth && !requirements.isPending && (
        <Alert
          type="info"
          showIcon
          className="!mb-4"
          title="Tài khoản chưa có mật khẩu đăng nhập"
          description="Hãy tạo mật khẩu để tăng cường bảo vệ tài khoản và có thể đăng nhập trực tiếp bằng email."
        />
      )}
      <Form
        form={form}
        layout="horizontal"
        labelAlign="left"
        labelCol={{ xs: { span: 24 }, sm: { flex: '220px' } }}
        wrapperCol={{ xs: { span: 24 }, sm: { flex: '1' } }}
        colon={false}
        onFinish={submit}
        initialValues={{ logout_all_sessions: false }}
        className="p-0 [&_.ant-form-item]:!mb-3 [&_.ant-form-item-label>label]:!text-sm [&_.ant-form-item-label>label]:!text-slate-600"
      >
        {showEmail && (
          <Form.Item label="Email đăng nhập">
            <Input
              aria-label="Email đăng nhập"
              autoComplete="username"
              value={user?.email || ''}
              readOnly
            />
          </Form.Item>
        )}
        {hasPassword && (
          <Form.Item name="current_password" label="Mật khẩu hiện tại" rules={[{ required: true, message: 'Nhập mật khẩu hiện tại' }]}>
            <Input.Password size="middle" autoComplete="current-password" placeholder="Nhập mật khẩu hiện tại" />
          </Form.Item>
        )}
        <div className="relative">
          <Form.Item
            name="password"
            label="Mật khẩu mới"
            rules={[
              { required: true, message: 'Nhập mật khẩu mới' },
              { validator: validateNewPassword },
            ]}
          >
            <Input.Password
              size="middle"
              autoComplete="new-password"
              prefix={<LockOutlined />}
              placeholder="Nhập mật khẩu mới"
              onFocus={() => setPasswordFocused(true)}
              onBlur={() => setPasswordFocused(false)}
            />
          </Form.Item>
          {passwordFocused && <PasswordStrengthGuide value={passwordValue} />}
        </div>
        <Form.Item
          name="confirm_password"
          label="Nhập lại mật khẩu mới"
          dependencies={['password']}
          rules={[
            { required: true, message: 'Nhập lại mật khẩu mới' },
            ({ getFieldValue }) => ({
              validator: (_, value) => !value || value === getFieldValue('password')
                ? Promise.resolve()
                : Promise.reject(new Error('Mật khẩu nhập lại không khớp')),
            }),
          ]}
        >
          <Input.Password size="middle" autoComplete="new-password" placeholder="Nhập lại mật khẩu mới" />
        </Form.Item>
        <Form.Item name="logout_all_sessions" valuePropName="checked" label={null} className="!mb-3 sm:ml-[220px]">
          <Checkbox>Đăng xuất khỏi các thiết bị khác</Checkbox>
        </Form.Item>
        <Form.Item label={null} className="!mb-0 sm:ml-[220px]">
          <div className="grid gap-2 sm:flex sm:gap-3">
            <Button htmlType="button" size="middle" onClick={() => form.resetFields()} className="min-w-24">Hủy</Button>
            <Button
              type="primary"
              htmlType="submit"
              size="middle"
              loading={mutation.isPending}
              disabled={needsReauth}
              className="min-w-24"
            >
              {hasPassword ? 'Cập nhật' : 'Tạo mật khẩu'}
            </Button>
          </div>
        </Form.Item>
      </Form>
    </div>
  )
}
