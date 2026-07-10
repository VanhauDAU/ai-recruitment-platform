import { ArrowRightOutlined, LockOutlined, MailOutlined, PhoneOutlined, UserOutlined } from '@ant-design/icons'
import { Alert, Checkbox, Form, Input } from 'antd'
import { useState } from 'react'
import { useGoogleReCaptcha } from 'react-google-recaptcha-v3'
import { Link, useNavigate } from 'react-router-dom'
import { getApiErrorMessage } from '../../../api/errorMessage'
import { register } from '../../../api/authService'
import AuthLogo from '../../../components/auth/AuthLogo'
import PasswordRequirements from '../../../components/auth/PasswordRequirements'
import { passwordValidationRule } from '../../../components/auth/passwordValidation'
import SocialLoginButtons from '../../../components/auth/SocialLoginButtons'
import { useAuth } from '../../../hooks/useAuth'
import { useSiteSettings } from '../../../hooks/useSiteSettings'

export default function Register() {
  const { siteName } = useSiteSettings()
  const { refreshUser } = useAuth()
  const navigate = useNavigate()
  const { executeRecaptcha } = useGoogleReCaptcha()
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [mode, setMode] = useState('social')
  const [form] = Form.useForm()
  const password = Form.useWatch('password', form) || ''

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
        setError(getApiErrorMessage(err, 'Đăng ký thất bại. Vui lòng thử lại.'))
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
            <SocialLoginButtons portal="main" action="Đăng ký" />
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

          <Form form={form} layout="vertical" onFinish={onFinish} requiredMark={false}>
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
