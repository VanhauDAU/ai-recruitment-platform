import { ArrowRightOutlined, LockOutlined, MailOutlined, PhoneOutlined } from '@ant-design/icons'
import { Alert, Form, Input } from 'antd'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'

const HOME_BY_ROLE = {
  candidate: '/candidate/dashboard',
  employer: '/employer/dashboard',
  admin: '/admin/dashboard',
}

// SVG icons for social providers
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

export default function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function onFinish(values) {
    setError('')
    setLoading(true)
    try {
      const user = await login(values)
      navigate(HOME_BY_ROLE[user.role] || '/')
    } catch {
      setError('Email hoặc mật khẩu không đúng. Vui lòng thử lại.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="w-full">
      <style>{`
        @keyframes fadeSlideUp {
          from { opacity: 0; transform: translateY(18px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        .login-card { animation: fadeSlideUp 0.45s cubic-bezier(0.22,1,0.36,1) both; }
        .login-field { animation: fadeSlideUp 0.45s cubic-bezier(0.22,1,0.36,1) both; }
        .login-field:nth-child(1) { animation-delay: 0.05s; }
        .login-field:nth-child(2) { animation-delay: 0.1s; }
        .login-field:nth-child(3) { animation-delay: 0.15s; }
        .login-field:nth-child(4) { animation-delay: 0.2s; }
        .social-btn { transition: all 0.18s ease; }
        .social-btn:hover { transform: translateY(-2px); box-shadow: 0 4px 16px rgba(0,0,0,0.08); }
        .submit-btn {
          position: relative; overflow: hidden;
          background: linear-gradient(135deg, #00b14f 0%, #008a3e 100%);
          transition: all 0.2s ease;
        }
        .submit-btn:hover { transform: translateY(-1px); box-shadow: 0 8px 24px rgba(0,177,79,0.35); }
        .submit-btn:active { transform: translateY(0); }
        .submit-btn::after {
          content: ''; position: absolute; inset: 0;
          background: linear-gradient(135deg, rgba(255,255,255,0.12) 0%, transparent 60%);
          pointer-events: none;
        }
        .divider-line { flex: 1; height: 1px; background: linear-gradient(to right, transparent, #e5e7eb, transparent); }
      `}</style>

      {/* Logo + Tiêu đề */}
      <div className="login-card mb-7 text-center">
        {/* Logo lớn */}
        <Link to="/" className="inline-flex items-center gap-3 mb-5 group">
          <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-gradient-to-br from-[#00b14f] to-[#008a3e] shadow-lg shadow-[#00b14f]/30 group-hover:shadow-[#00b14f]/50 transition-all">
            <svg viewBox="0 0 24 24" className="w-7 h-7" fill="none" aria-hidden="true">
              <path d="M13 3L4 14h8l-1 7 9-11h-8l1-10z" fill="white" strokeLinejoin="round"/>
            </svg>
          </div>
          <div className="text-left">
            <span className="block text-xl font-extrabold tracking-tight text-gray-900 dark:text-white leading-none">
              AI Career
            </span>
            <span className="block text-xl font-extrabold tracking-tight text-[#00b14f] leading-none">
              Coach
            </span>
          </div>
        </Link>

        <div className="inline-flex items-center gap-2 rounded-full bg-[#e6f7ee] px-3 py-1 mb-3">
          <span className="w-2 h-2 rounded-full bg-[#00b14f] animate-pulse" />
          <span className="text-xs font-semibold text-[#00b14f] tracking-wide">Chào mừng trở lại!</span>
        </div>
        <h2 className="text-[1.75rem] font-extrabold leading-tight text-gray-900 dark:text-white">
          Đăng nhập vào<br />
          <span className="bg-gradient-to-r from-[#00b14f] to-[#008a3e] bg-clip-text text-transparent">
            AI Career Coach
          </span>
        </h2>
        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
          Nhập thông tin tài khoản để tiếp tục hành trình nghề nghiệp của bạn.
        </p>
      </div>

      {/* Social login */}
      <div className="login-field mb-5">
        <div className="grid grid-cols-12 gap-3">
          {SOCIAL_PROVIDERS.map(({ key, label, Icon, span, border }) => (
            <button
              key={key}
              type="button"
              aria-label={`Đăng nhập bằng ${label}`}
              className={`social-btn ${span} flex h-12 items-center justify-center gap-2 rounded-xl border bg-white px-4 text-sm font-medium text-gray-700 cursor-pointer dark:bg-zinc-800 dark:text-gray-200 dark:border-zinc-700 ${border}`}
            >
              <Icon />
              <span>{label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Divider */}
      <div className="login-field flex items-center gap-3 mb-5">
        <div className="divider-line" />
        <span className="shrink-0 text-xs font-medium text-gray-400 uppercase tracking-widest">
          hoặc đăng nhập bằng email
        </span>
        <div className="divider-line" />
      </div>

      {/* Error */}
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

      {/* Form */}
      <Form layout="vertical" onFinish={onFinish} requiredMark={false} className="space-y-0">
        {/* Email */}
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
              prefix={<MailOutlined className="text-[#00b14f]" />}
              placeholder="ten@congty.com"
              className="!rounded-xl !h-12 !text-base"
            />
          </Form.Item>
        </div>

        {/* Password + Quên mật khẩu */}
        <div className="login-field">
          {/* Label row: tách khỏi Form.Item để justify-between hoạt động đúng */}
          <div className="flex items-center justify-between mb-1.5">
            <label
              htmlFor="login_password"
              className="text-sm font-semibold text-gray-700 dark:text-gray-300 cursor-default"
            >
              Mật khẩu
            </label>
            <Link
              to="/forgot-password"
              className="text-xs font-medium text-[#00b14f] hover:text-[#008a3e] hover:underline underline-offset-2 transition-colors"
              tabIndex={-1}
            >
              Quên mật khẩu?
            </Link>
          </div>
          <Form.Item
            name="password"
            id="login_password"
            rules={[{ required: true, message: 'Vui lòng nhập mật khẩu' }]}
            className="!mb-4"
          >
            <Input.Password
              size="large"
              autoComplete="current-password"
              prefix={<LockOutlined className="text-[#00b14f]" />}
              placeholder="Nhập mật khẩu của bạn"
              className="!rounded-xl !h-12 !text-base"
            />
          </Form.Item>
        </div>

        {/* Submit button */}
        <div className="login-field pt-1">
          <button
            type="submit"
            disabled={loading}
            className="submit-btn w-full flex items-center justify-center gap-2.5 rounded-xl px-6 py-3.5 text-base font-bold text-white cursor-pointer disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {loading ? (
              <>
                <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="white" strokeWidth="4"/>
                  <path className="opacity-75" fill="white" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                </svg>
                Đang đăng nhập...
              </>
            ) : (
              <>
                Đăng nhập
                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-white/20">
                  <ArrowRightOutlined className="text-xs" />
                </span>
              </>
            )}
          </button>
        </div>
      </Form>

      {/* Register link */}
      <div className="login-field mt-6 text-center">
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Bạn chưa có tài khoản?{' '}
          <Link
            to="/register"
            className="font-semibold text-[#00b14f] hover:text-[#008a3e] hover:underline transition-colors"
          >
            Đăng ký ngay
          </Link>
        </p>
      </div>

      {/* Support hotline */}
      <div className="login-field mt-6 rounded-2xl border border-gray-100 bg-gray-50 px-4 py-3.5 dark:border-zinc-800 dark:bg-zinc-900">
        <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed text-center">
          Bạn có gặp khó khăn khi tạo tài khoản?{' '}
          <br className="sm:hidden" />
          Vui lòng gọi tới số{' '}
          <a
            href="tel:0777464347"
            className="inline-flex items-center gap-1 font-semibold text-[#00b14f] hover:underline"
          >
            <PhoneOutlined className="text-[11px]" />
            0777 46 43 47
          </a>
          {' '}(Giờ hành chính)
        </p>
      </div>
    </div>
  )
}
