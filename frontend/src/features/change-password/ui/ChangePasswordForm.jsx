import { ExclamationCircleFilled, LockOutlined } from '@ant-design/icons'
import { useMutation } from '@tanstack/react-query'
import { Alert, App, Button, Checkbox, Form, Input } from 'antd'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSession } from '@/entities/session'
import { getApiErrorMessage } from '@/shared/api/error-mapper'
import { setTokens } from '@/shared/api/token-store'
import { EMPLOYER_PHONE_VERIFY_URL } from '@/shared/config/portals'
import { changeCurrentPassword } from '../api/change-password.api'

const PASSWORD_PATTERN = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,25}$/

const PASSWORD_CHECKS = [
  { label: 'Ít nhất 8 ký tự', test: (value) => value.length >= 8 },
  { label: 'Có chữ in hoa và chữ thường', test: (value) => /[a-z]/.test(value) && /[A-Z]/.test(value) },
  { label: 'Có ít nhất 1 số', test: (value) => /\d/.test(value) },
  { label: 'Có ít nhất 1 ký tự đặc biệt (!, @, #, ...)', test: (value) => /[^A-Za-z0-9]/.test(value) },
]

function PasswordStrengthGuide({ value }) {
  const passed = PASSWORD_CHECKS.filter((check) => check.test(value)).length
  const label = passed === PASSWORD_CHECKS.length ? 'Mật khẩu mạnh' : passed >= 2 ? 'Mật khẩu trung bình' : 'Mật khẩu yếu'
  const color = passed === PASSWORD_CHECKS.length ? 'bg-emerald-500' : passed >= 2 ? 'bg-amber-400' : 'bg-red-400'

  return (
    <div className="absolute left-0 right-0 top-[42px] z-20 rounded-lg bg-white p-3 shadow-[0_6px_18px_rgba(15,23,42,.12)] ring-1 ring-slate-100 sm:left-[220px]">
      <div className="flex items-center gap-2 text-sm font-bold text-slate-700">
        <ExclamationCircleFilled className={passed === PASSWORD_CHECKS.length ? 'text-emerald-500' : 'text-red-500'} />
        {label}
      </div>
      <div className="mt-2 flex gap-2" aria-label={`Độ mạnh mật khẩu: ${passed} trên 4`}>
        {PASSWORD_CHECKS.map((check, index) => <span key={check.label} className={`h-1 flex-1 rounded-full ${index < passed ? color : 'bg-slate-200'}`} />)}
      </div>
      <ul className="mt-2 space-y-1.5 text-xs text-slate-600">
        {PASSWORD_CHECKS.map((check) => {
          const valid = check.test(value)
          return <li key={check.label} className={`flex items-center gap-2 ${valid ? 'text-emerald-600' : ''}`}><span className={`h-2 w-2 rounded-full border ${valid ? 'border-emerald-500 bg-emerald-500' : 'border-slate-400'}`} />{check.label}</li>
        })}
      </ul>
    </div>
  )
}

export default function ChangePasswordForm() {
  const { user, setCurrentUser } = useSession()
  const { message } = App.useApp()
  const navigate = useNavigate()
  const [form] = Form.useForm()
  const hasPassword = Boolean(user?.has_usable_password)
  const passwordValue = Form.useWatch('password', form) || ''
  const [passwordFocused, setPasswordFocused] = useState(false)
  const mutation = useMutation({
    mutationFn: changeCurrentPassword,
    onSuccess: (result) => {
      // Thay access token trong memory; backend đã xoay refresh cookie và `sid`.
      if (result.tokens) setTokens(result.tokens)
      if (result.user) setCurrentUser(result.user)
      message.success(result.detail || 'Cập nhật mật khẩu thành công.')
      navigate(EMPLOYER_PHONE_VERIFY_URL, { replace: true })
    },
    onError: (error) => {
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
    mutation.mutate({
      current_password: values.current_password || '',
      password: values.password,
      logout_all_sessions: Boolean(values.logout_all_sessions),
    })
  }

  return (
    <div className="max-w-[960px]">
      {!hasPassword && (
        <Alert
          type="info"
          showIcon
          className="!mb-4"
          title="Tài khoản Google chưa có mật khẩu đăng nhập"
          description="Hãy tạo mật khẩu trước khi xác thực số điện thoại để bảo vệ các thao tác quan trọng trên tài khoản."
        />
      )}
      <Form
        form={form}
        layout="horizontal"
        labelAlign="left"
        labelCol={{ flex: '220px' }}
        wrapperCol={{ flex: '1' }}
        colon={false}
        onFinish={submit}
        initialValues={{ logout_all_sessions: false }}
        className="p-0 [&_.ant-form-item]:!mb-3 [&_.ant-form-item-label>label]:!text-sm [&_.ant-form-item-label>label]:!text-slate-600"
      >
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
              { pattern: PASSWORD_PATTERN, message: 'Mật khẩu 8–25 ký tự, có chữ hoa, chữ thường, số và ký tự đặc biệt' },
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
          <div className="flex gap-3">
            <Button htmlType="button" size="middle" onClick={() => form.resetFields()} className="min-w-24">Hủy</Button>
            <Button type="primary" htmlType="submit" size="middle" loading={mutation.isPending} className="min-w-24">
              {hasPassword ? 'Cập nhật' : 'Tạo mật khẩu'}
            </Button>
          </div>
        </Form.Item>
      </Form>
    </div>
  )
}
