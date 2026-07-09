import { ArrowRightOutlined, LockOutlined, MailOutlined, PhoneOutlined, UserOutlined } from '@ant-design/icons'
import { Alert, Checkbox, Form, Input } from 'antd'
import { useState } from 'react'
import { useGoogleReCaptcha } from 'react-google-recaptcha-v3'
import { Link, useNavigate } from 'react-router-dom'
import { register } from '../../../api/authService'
import AuthLogo from '../../../components/auth/AuthLogo'
import { useAuth } from '../../../hooks/useAuth'
import { useSiteSettings } from '../../../hooks/useSiteSettings'

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-5 h-5" aria-hidden="true">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  )
}
function FacebookIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-5 h-5" aria-hidden="true" fill="#1877F2">
      <path d="M24 12.073C24 5.405 18.627 0 12 0S0 5.405 0 12.073C0 18.1 4.388 23.094 10.125 24v-8.437H7.078v-3.49h3.047V9.41c0-3.025 1.792-4.697 4.533-4.697 1.312 0 2.686.236 2.686.236v2.97h-1.513c-1.491 0-1.956.93-1.956 1.886v2.267h3.328l-.532 3.49h-2.796V24C19.612 23.094 24 18.1 24 12.073z"/>
    </svg>
  )
}
function LinkedInIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-5 h-5" aria-hidden="true" fill="#0A66C2">
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
    </svg>
  )
}

const SOCIAL_PROVIDERS = [
  { key: 'google', label: 'Google', Icon: GoogleIcon, span: 'col-span-12', border: 'border-[#dadce0] hover:border-[#4285F4] hover:bg-blue-50/40' },
  { key: 'facebook', label: 'Facebook', Icon: FacebookIcon, span: 'col-span-12 sm:col-span-6', border: 'border-[#dadce0] hover:border-[#1877F2] hover:bg-blue-50/40' },
  { key: 'linkedin', label: 'LinkedIn', Icon: LinkedInIcon, span: 'col-span-12 sm:col-span-6', border: 'border-[#dadce0] hover:border-[#0A66C2] hover:bg-blue-50/40' },
]

export default function Register() {
  const { siteName } = useSiteSettings()
  const { refreshUser } = useAuth()
  const navigate = useNavigate()
  const { executeRecaptcha } = useGoogleReCaptcha()
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [mode, setMode] = useState('social')

  async function onFinish(values) {
    if (!executeRecaptcha) {
      setError('Captcha chưa sẵn sàng, vui lòng thử lại.')
      return
    }
    setError('')
    setLoading(true)
    try {
      const captchaToken = await executeRecaptcha('register')
      const payload = {
        full_name: values.full_name,
        email: values.email,
        password: values.password,
      }
      await register({ ...payload, role: 'candidate', captcha_token: captchaToken, portal: 'main' })
      // Đăng ký xong đăng nhập luôn; email chưa xác thực -> banner nhắc xác thực ở layout.
      await refreshUser()
      navigate('/')
    } catch (err) {
      if (err.response?.status === 429) {
        setError('Bạn thao tác quá nhanh, vui lòng thử lại sau ít phút.')
      } else {
        const data = err.response?.data
        setError(data ? Object.values(data).flat().join(' ') : 'Đăng ký thất bại. Vui lòng thử lại.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="w-full">
      <style>{`
        @keyframes regSlideUp {
          from { opacity: 0; transform: translateY(18px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .reg-card { animation: regSlideUp 0.45s cubic-bezier(0.22,1,0.36,1) both; }
        .reg-field { animation: regSlideUp 0.45s cubic-bezier(0.22,1,0.36,1) both; }
        .reg-field:nth-child(1) { animation-delay: 0.05s; }
        .reg-field:nth-child(2) { animation-delay: 0.10s; }
        .reg-field:nth-child(3) { animation-delay: 0.15s; }
        .reg-field:nth-child(4) { animation-delay: 0.20s; }
        .reg-field:nth-child(5) { animation-delay: 0.25s; }
        .reg-social-btn { transition: all 0.18s ease; }
        .reg-social-btn:hover { transform: translateY(-2px); box-shadow: 0 4px 16px rgba(0,0,0,0.08); }
        .reg-submit {
          position: relative; overflow: hidden;
          background: linear-gradient(135deg, var(--brand-primary) 0%, var(--brand-primary-hover) 100%);
          transition: all 0.2s ease;
        }
        .reg-submit:hover { transform: translateY(-1px); box-shadow: 0 8px 24px rgba(0,177,79,0.35); }
        .reg-submit:active { transform: translateY(0); }
        .reg-submit::after {
          content:''; position:absolute; inset:0;
          background:linear-gradient(135deg,rgba(255,255,255,0.12) 0%,transparent 60%);
          pointer-events:none;
        }
        .divider-line { flex:1; height:1px; background:linear-gradient(to right,transparent,#e5e7eb,transparent); }
      `}</style>

      {/* Tiêu đề */}
      <div className="reg-card mb-4 text-center">
        <AuthLogo className="mb-2" />
        <h2 className="text-xl font-bold text-gray-900 dark:text-white">
          Đăng ký
        </h2>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Tạo tài khoản miễn phí, tìm kiếm hơn 60.000 việc làm.
        </p>
      </div>

      {mode === 'social' ? (
        <>
          <div className="reg-field mb-3">
            <div className="grid grid-cols-12 gap-3">
              {SOCIAL_PROVIDERS.map(({ key, label, Icon, span, border }) => (
                <button
                  key={key}
                  type="button"
                  aria-label={`Đăng ký bằng ${label}`}
                  className={`reg-social-btn ${span} flex h-11 items-center justify-center gap-2 rounded-full border bg-white px-4 text-sm font-medium text-gray-700 cursor-pointer dark:bg-zinc-800 dark:text-gray-200 dark:border-zinc-700 ${border}`}
                >
                  <Icon />
                  <span>{label}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="reg-field flex items-center gap-3 mb-3">
            <div className="divider-line" />
            <span className="shrink-0 text-xs font-medium text-gray-400 uppercase tracking-widest">Hoặc</span>
            <div className="divider-line" />
          </div>

          <div className="reg-field">
            <button
              type="button"
              onClick={() => {
                setError('')
                setMode('email')
              }}
              className="flex h-11 w-full items-center justify-center gap-2.5 rounded-full border border-[var(--brand-primary)] bg-white px-6 text-sm font-bold text-[var(--brand-primary)] transition hover:bg-green-50 cursor-pointer dark:bg-zinc-800"
            >
              <MailOutlined />
              Đăng ký bằng email
            </button>
          </div>
        </>
      ) : (
        <>
          {error && (
            <Alert type="error" message={error} showIcon className="mb-4 !rounded-xl reg-field" closable onClose={() => setError('')} />
          )}

          <Form layout="vertical" onFinish={onFinish} requiredMark={false}>
            <div className="reg-field">
              <Form.Item
                name="full_name"
                label={<span className="text-sm font-semibold text-gray-700 dark:text-gray-300">Họ và tên</span>}
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

            <div className="reg-field">
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
                  placeholder="ten@email.com"
                  className="!rounded-full !h-11 !text-base"
                />
              </Form.Item>
            </div>

            <div className="reg-field">
              <Form.Item
                name="password"
                label={<span className="text-sm font-semibold text-gray-700 dark:text-gray-300">Mật khẩu</span>}
                rules={[
                  { required: true, message: 'Vui lòng nhập mật khẩu' },
                  { min: 8, message: 'Mật khẩu tối thiểu 8 ký tự' },
                ]}
                className="!mb-3"
              >
                <Input.Password
                  size="large"
                  autoComplete="new-password"
                  prefix={<LockOutlined className="text-[var(--brand-primary)]" />}
                  placeholder="Tối thiểu 8 ký tự"
                  className="!rounded-full !h-11 !text-base"
                />
              </Form.Item>
            </div>

            <div className="reg-field">
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

            <div className="reg-field">
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
                    Tôi đã đọc và đồng ý với{' '}
                    <a
                      href="https://www.topcv.vn/terms-of-service"
                      target="_blank"
                      rel="noreferrer"
                      className="font-semibold text-[var(--brand-primary)] hover:underline"
                    >
                      Điều khoản dịch vụ
                    </a>{' '}
                    và{' '}
                    <a
                      href="https://www.topcv.vn/dieu-khoan-bao-mat"
                      target="_blank"
                      rel="noreferrer"
                      className="font-semibold text-[var(--brand-primary)] hover:underline"
                    >
                      Chính sách quyền riêng tư
                    </a>{' '}
                    của {siteName}.
                  </span>
                </Checkbox>
              </Form.Item>
            </div>

            <div className="reg-field">
              <button
                type="submit"
                disabled={loading}
                className="reg-submit w-full flex items-center justify-center gap-2.5 rounded-full px-6 py-3 text-base font-bold text-white cursor-pointer disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <>
                    <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="white" strokeWidth="4"/>
                      <path className="opacity-75" fill="white" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                    </svg>
                    Đang tạo tài khoản...
                  </>
                ) : (
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

          <div className="reg-field flex items-center gap-3 my-3">
            <div className="divider-line" />
            <span className="shrink-0 text-xs font-medium text-gray-400 uppercase tracking-widest">Hoặc</span>
            <div className="divider-line" />
          </div>

          <div className="reg-field">
            <button
              type="button"
              onClick={() => {
                setError('')
                setMode('social')
              }}
              className="flex h-11 w-full items-center justify-center gap-2.5 rounded-full border border-gray-200 bg-white px-6 text-sm font-bold text-gray-700 transition hover:border-[var(--brand-primary)] hover:bg-green-50 hover:text-[var(--brand-primary)] cursor-pointer dark:border-zinc-700 dark:bg-zinc-800 dark:text-gray-200"
            >
              <ArrowRightOutlined className="text-xs" />
              Đăng ký bằng tài khoản mạng xã hội
            </button>
          </div>
        </>
      )}

      {/* Login link */}
      <div className="reg-field mt-4 text-center">
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Đã có tài khoản?{' '}
          <Link to="/login" className="font-semibold text-[var(--brand-primary)] hover:text-[var(--brand-primary-hover)] hover:underline transition-colors">
            Đăng nhập ngay
          </Link>
        </p>
      </div>

      {/* Support hotline */}
      <div className="reg-field mt-3 rounded-2xl border border-gray-100 bg-gray-50 px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900">
        <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed text-center">
          Bạn có gặp khó khăn khi tạo tài khoản?{' '}
          Vui lòng gọi tới số{' '}
          <a href="tel:0777464347" className="inline-flex items-center gap-1 font-semibold text-[var(--brand-primary)] hover:underline">
            <PhoneOutlined className="text-[11px]" />
            0777 46 43 47
          </a>
          {' '}(Giờ hành chính)
        </p>
      </div>
    </div>
  )
}
