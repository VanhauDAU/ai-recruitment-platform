import { ArrowLeftOutlined, MailOutlined } from '@ant-design/icons'
import { Alert, Form, Input } from 'antd'
import { useState } from 'react'
import { useGoogleReCaptcha } from 'react-google-recaptcha-v3'
import { Link } from 'react-router-dom'
import { AuthFormStyles, AuthLogo, requestPasswordReset } from '@/features/auth'
import { getApiErrorMessage } from '@/shared/api/error-mapper'

// Bước 1: nhập email -> backend gửi link đặt lại. Backend luôn trả cùng một
// thông điệp dù email có tồn tại hay không, nên màn hình này không được suy đoán
// "email không tồn tại" — cứ hiện màn "đã gửi".
export default function ForgotPassword() {
  const { executeRecaptcha } = useGoogleReCaptcha()
  const [sentTo, setSentTo] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function onFinish({ email }) {
    if (!executeRecaptcha) {
      setError('Captcha chưa sẵn sàng, vui lòng thử lại.')
      return
    }
    setError('')
    setLoading(true)
    try {
      const captchaToken = await executeRecaptcha('password_reset')
      await requestPasswordReset({ email, captcha_token: captchaToken })
      setSentTo(email)
    } catch (err) {
      setError(
        err.response?.status === 429
          ? 'Bạn thao tác quá nhanh, vui lòng thử lại sau ít phút.'
          : getApiErrorMessage(err, 'Không gửi được email, vui lòng thử lại.'),
      )
    } finally {
      setLoading(false)
    }
  }

  if (sentTo) {
    return (
      <div className="w-full text-center">
        <AuthFormStyles />
        <div className="login-card">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-50 dark:bg-green-950/40">
            <MailOutlined className="text-3xl" style={{ color: 'var(--brand-primary)' }} />
          </div>
          <h2 className="mt-4 text-xl font-bold text-gray-900 dark:text-white">Kiểm tra hòm thư của bạn</h2>
          <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-gray-600 dark:text-gray-300">
            Nếu <strong className="text-gray-900 dark:text-white">{sentTo}</strong> đã đăng ký tài khoản, chúng tôi
            vừa gửi một liên kết đặt lại mật khẩu. Liên kết có hiệu lực trong 30 phút.
          </p>
          <p className="mt-4 text-xs text-gray-500 dark:text-gray-400">
            Không thấy email? Hãy kiểm tra mục <strong>Spam</strong>, hoặc{' '}
            <button
              type="button"
              onClick={() => setSentTo('')}
              className="font-medium text-[var(--brand-primary)] hover:underline"
            >
              thử lại với email khác
            </button>
            .
          </p>
          <Link
            to="/login"
            className="mt-6 inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--brand-primary)] hover:underline"
          >
            <ArrowLeftOutlined className="text-xs" />
            Quay lại đăng nhập
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full">
      <AuthFormStyles />

      <div className="login-card mb-7 text-center">
        <AuthLogo className="mb-3" />
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">Quên mật khẩu?</h2>
        <p className="mt-1.5 text-sm text-gray-500 dark:text-gray-400">
          Nhập email đăng ký, chúng tôi sẽ gửi liên kết để bạn tạo mật khẩu mới.
        </p>
      </div>

      {error && (
        <Alert type="error" message={error} showIcon closable onClose={() => setError('')} className="mb-4 !rounded-xl login-field" />
      )}

      <Form layout="vertical" onFinish={onFinish} requiredMark={false}>
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
              autoFocus
              prefix={<MailOutlined className="text-[var(--brand-primary)]" />}
              placeholder="ten@congty.com"
              className="!rounded-full !h-11 !text-base"
            />
          </Form.Item>
        </div>

        <div className="login-field pt-1">
          <button
            type="submit"
            disabled={loading}
            className="submit-btn w-full rounded-full px-6 py-3.5 text-base font-bold text-white cursor-pointer disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {loading ? 'Đang gửi...' : 'Gửi liên kết đặt lại'}
          </button>
        </div>
      </Form>

      <div className="login-field mt-6 text-center">
        <Link
          to="/login"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--brand-primary)] hover:underline"
        >
          <ArrowLeftOutlined className="text-xs" />
          Quay lại đăng nhập
        </Link>
      </div>
    </div>
  )
}
