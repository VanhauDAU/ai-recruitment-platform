import { LockOutlined, SafetyCertificateOutlined } from '@ant-design/icons'
import { useMutation } from '@tanstack/react-query'
import { Alert, App, Button, Checkbox, Form, Input } from 'antd'
import { useNavigate } from 'react-router-dom'
import { useSession } from '@/entities/session'
import { getApiErrorMessage } from '@/shared/api/error-mapper'
import { EMPLOYER_PHONE_VERIFY_URL } from '@/shared/config/portals'
import { changeCurrentPassword } from '../api/change-password.api'

const PASSWORD_PATTERN = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,25}$/

export default function ChangePasswordForm() {
  const { user, setCurrentUser } = useSession()
  const { message } = App.useApp()
  const navigate = useNavigate()
  const [form] = Form.useForm()
  const hasPassword = Boolean(user?.has_usable_password)
  const mutation = useMutation({
    mutationFn: changeCurrentPassword,
    onSuccess: (result) => {
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
    <div className="mx-auto max-w-2xl">
      {!hasPassword && (
        <Alert
          type="info"
          showIcon
          className="!mb-6"
          title="Tài khoản Google chưa có mật khẩu đăng nhập"
          description="Hãy tạo mật khẩu trước khi xác thực số điện thoại để bảo vệ các thao tác quan trọng trên tài khoản."
        />
      )}
      <Form form={form} layout="vertical" onFinish={submit} initialValues={{ logout_all_sessions: false }}>
        {hasPassword && (
          <Form.Item name="current_password" label="Mật khẩu hiện tại" rules={[{ required: true, message: 'Nhập mật khẩu hiện tại' }]}>
            <Input.Password size="large" autoComplete="current-password" prefix={<LockOutlined />} placeholder="Nhập mật khẩu hiện tại" />
          </Form.Item>
        )}
        <Form.Item
          name="password"
          label="Mật khẩu mới"
          rules={[
            { required: true, message: 'Nhập mật khẩu mới' },
            { pattern: PASSWORD_PATTERN, message: 'Mật khẩu 8–25 ký tự, có chữ hoa, chữ thường và số' },
          ]}
        >
          <Input.Password size="large" autoComplete="new-password" prefix={<LockOutlined />} placeholder="Nhập mật khẩu mới" />
        </Form.Item>
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
          <Input.Password size="large" autoComplete="new-password" prefix={<LockOutlined />} placeholder="Nhập lại mật khẩu mới" />
        </Form.Item>
        <Form.Item name="logout_all_sessions" valuePropName="checked">
          <Checkbox>Thoát tất cả các phiên đăng nhập hiện tại</Checkbox>
        </Form.Item>
        <div className="rounded-xl bg-slate-50 p-4 text-xs leading-5 text-slate-500">
          <SafetyCertificateOutlined className="mr-2 text-emerald-600" />
          Không sử dụng lại mật khẩu email hoặc mật khẩu đã dùng ở dịch vụ khác.
        </div>
        <Button type="primary" htmlType="submit" size="large" block loading={mutation.isPending} className="!mt-6 !h-12 !font-bold">
          {hasPassword ? 'Cập nhật mật khẩu' : 'Tạo mật khẩu đăng nhập'}
        </Button>
      </Form>
    </div>
  )
}
