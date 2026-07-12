import { ArrowRightOutlined, LockOutlined, MailOutlined, UserOutlined } from '@ant-design/icons'
import { Alert, Checkbox, Form, Input } from 'antd'
import { useState } from 'react'
import { useGoogleReCaptcha } from 'react-google-recaptcha-v3'
import { Link, useNavigate } from 'react-router-dom'
import {
  AuthFormStyles,
  AuthLogo,
  logout as clearStoredAuth,
  passwordValidationRule,
  PasswordRequirements,
  register,
  SocialLoginButtons,
} from '@/features/auth'
import { getApiErrorMessage } from '@/shared/api/error-mapper'
import { employerAppPath } from '@/shared/config/portals'
import { useSiteSettings } from '@/entities/site-settings'

// Đăng ký tài khoản Nhà tuyển dụng (role=employer) — email hoặc Google.
export default function EmployerRegister() {
  const { siteName } = useSiteSettings()
  const navigate = useNavigate()
  const { executeRecaptcha } = useGoogleReCaptcha()
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [form] = Form.useForm()
  const password = Form.useWatch('password', form) || ''

  function clearPasswords() {
    form.resetFields(['password', 'confirm_password'])
  }

  async function onFinish(values) {
    if (!executeRecaptcha) {
      clearPasswords()
      setError('Captcha chưa sẵn sàng, vui lòng thử lại.')
      return
    }
    setError('')
    setLoading(true)
    try {
      const captchaToken = await executeRecaptcha('register')
      await register({
        full_name: values.full_name,
        email: values.email,
        password: values.password,
        role: 'employer',
        captcha_token: captchaToken,
      })
      // Cổng employer yêu cầu người dùng đăng nhập lại, nên không giữ JWT vừa
      // được backend cấp trong response đăng ký.
      clearStoredAuth('employer')
      navigate(employerAppPath('/login'))
    } catch (err) {
      clearPasswords()
      if (err.response?.status === 429) {
        setError('Bạn thao tác quá nhanh, vui lòng thử lại sau ít phút.')
      } else {
        setError(getApiErrorMessage(err, 'Đăng ký thất bại. Vui lòng thử lại.'))
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="w-full">
      <AuthFormStyles />
      <div className="login-card mb-5 text-center">
        <AuthLogo className="mb-2" />
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">
          Đăng ký tài khoản Nhà tuyển dụng
        </h2>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Đăng tin tuyển dụng và tìm kiếm hồ sơ ứng viên.
        </p>
      </div>

      {error && (
        <Alert type="error" message={error} showIcon className="mb-4 !rounded-xl login-field" closable onClose={() => setError('')} />
      )}

      {/* Social login — cổng NTD chỉ hỗ trợ Google */}
      <div className="login-field mb-5">
        <SocialLoginButtons portal="employer" action="Đăng ký" />
      </div>

      <div className="login-field flex items-center gap-3 mb-5">
        <div className="divider-line" />
        <span className="shrink-0 text-xs font-medium text-gray-400 uppercase tracking-widest">
          hoặc đăng ký bằng email
        </span>
        <div className="divider-line" />
      </div>

      <Form form={form} layout="vertical" onFinish={onFinish} onFinishFailed={clearPasswords} requiredMark={false}>
        <div className="login-field">
          <Form.Item
            name="full_name"
            label={<span className="text-sm font-semibold text-gray-700 dark:text-gray-300">Họ tên người liên hệ</span>}
            rules={[{ required: true, message: 'Vui lòng nhập họ tên' }]}
            className="!mb-3"
          >
            <Input
              size="large"
              prefix={<UserOutlined className="text-[var(--brand-primary)]" />}
              placeholder="Nguyễn Văn A"
              className="!rounded-full !h-11 !text-base"
            />
          </Form.Item>
        </div>

        <div className="login-field">
          <Form.Item
            name="email"
            label={<span className="text-sm font-semibold text-gray-700 dark:text-gray-300">Email</span>}
            rules={[
              { required: true, message: 'Vui lòng nhập email' },
              { type: 'email', message: 'Email không hợp lệ' },
            ]}
            className="!mb-3"
          >
            <Input
              size="large"
              autoComplete="email"
              prefix={<MailOutlined className="text-[var(--brand-primary)]" />}
              placeholder="ten@congty.com"
              className="!rounded-full !h-11 !text-base"
            />
          </Form.Item>
        </div>

        <div className="login-field">
          <Form.Item
            name="password"
            label={<span className="text-sm font-semibold text-gray-700 dark:text-gray-300">Mật khẩu</span>}
            rules={[
              { required: true, message: 'Vui lòng nhập mật khẩu' },
              { validator: passwordValidationRule },
            ]}
            className="!mb-1"
          >
            <Input.Password
              size="large"
              autoComplete="new-password"
              prefix={<LockOutlined className="text-[var(--brand-primary)]" />}
              placeholder="Nhập mật khẩu"
              className="!rounded-full !h-11 !text-base"
            />
          </Form.Item>
          <PasswordRequirements password={password} />
        </div>

        <div className="login-field">
          <Form.Item
            name="confirm_password"
            label={<span className="text-sm font-semibold text-gray-700 dark:text-gray-300">Xác nhận mật khẩu</span>}
            dependencies={['password']}
            rules={[
              { required: true, message: 'Vui lòng xác nhận mật khẩu' },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue('password') === value) return Promise.resolve()
                  return Promise.reject(new Error('Mật khẩu xác nhận không khớp'))
                },
              }),
            ]}
            className="!mb-3"
          >
            <Input.Password
              size="large"
              autoComplete="new-password"
              prefix={<LockOutlined className="text-[var(--brand-primary)]" />}
              placeholder="Nhập lại mật khẩu"
              className="!rounded-full !h-11 !text-base"
            />
          </Form.Item>
        </div>

        <div className="login-field">
          <Form.Item
            name="terms"
            valuePropName="checked"
            rules={[
              {
                validator: (_, value) => (
                  value ? Promise.resolve() : Promise.reject(new Error('Bạn cần đồng ý với điều khoản để tiếp tục'))
                ),
              },
            ]}
          >
            <Checkbox className="!items-start">
              <span className="text-sm leading-relaxed text-gray-600 dark:text-gray-300">
                Tôi đã đọc và đồng ý với <span className="font-semibold text-[var(--brand-primary)]">Điều khoản dịch vụ</span> và{' '}
                <span className="font-semibold text-[var(--brand-primary)]">Chính sách quyền riêng tư</span> của {siteName}.
              </span>
            </Checkbox>
          </Form.Item>
        </div>

        <div className="login-field">
          <button
            type="submit"
            disabled={loading}
            className="submit-btn w-full flex items-center justify-center gap-2.5 rounded-full px-6 py-3 text-base font-bold text-white cursor-pointer disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {loading ? 'Đang tạo tài khoản...' : (
              <>
                Đăng ký
                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-white/20">
                  <ArrowRightOutlined className="text-xs" />
                </span>
              </>
            )}
          </button>
        </div>
      </Form>

      <div className="login-field mt-4 text-center">
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Đã có tài khoản?{' '}
          <Link
            to={employerAppPath('/login')}
            className="font-semibold text-[var(--brand-primary)] hover:text-[var(--brand-primary-hover)] hover:underline transition-colors"
          >
            Đăng nhập ngay
          </Link>
        </p>
      </div>
    </div>
  )
}
