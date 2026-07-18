import { ArrowLeftOutlined, ArrowRightOutlined, LockOutlined, MailOutlined, SafetyCertificateOutlined, TeamOutlined } from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import { Alert, Form, Input } from 'antd'
import { useState } from 'react'
import { useGoogleReCaptcha } from 'react-google-recaptcha-v3'
import { Link, useNavigate } from 'react-router-dom'
import {
  AuthFormStyles,
  AuthLogo,
  checkRegistrationEmail,
  passwordValidationRule,
  PasswordRequirements,
  registerEmployer,
  SocialLoginButtons,
} from '@/features/auth'
import { EmployerConsentFields, EmployerRegistrationFields } from '@/features/complete-employer-registration'
import { getProvinces } from '@/entities/location'
import { useSession } from '@/entities/session'
import { getApiErrorMessage } from '@/shared/api/error-mapper'
import { EMPLOYER_ACCOUNT_VERIFY_URL, EMPLOYER_COMPLETE_PROFILE_URL, employerAppPath } from '@/shared/config/portals'

const REGISTRATION_FIELDS = new Set([
  'email', 'password', 'full_name', 'gender', 'contact_phone',
  'work_location', 'terms_accepted', 'marketing_opt_in',
])

const REGISTRATION_STEPS = [
  { icon: <SafetyCertificateOutlined />, title: 'Tài khoản' },
  { icon: <TeamOutlined />, title: 'Thông tin nhà tuyển dụng' },
]

function RegistrationSectionTitle({ number, title, description }) {
  return (
    <div className="mb-6 flex items-start gap-3">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-xs font-black tracking-wide text-emerald-700">
        {number}
      </span>
      <div>
        <h2 className="text-lg font-black tracking-tight text-slate-900">{title}</h2>
        <p className="mt-1 text-sm leading-6 text-slate-500">{description}</p>
      </div>
    </div>
  )
}

export default function EmployerRegister() {
  const navigate = useNavigate()
  const { setCurrentUser } = useSession()
  const { executeRecaptcha } = useGoogleReCaptcha()
  const [form] = Form.useForm()
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [step, setStep] = useState(1)
  const password = Form.useWatch('password', form) || ''
  const termsAccepted = Form.useWatch('terms_accepted', form) === true
  const marketingOptIn = Form.useWatch('marketing_opt_in', form) === true
  const provincesQuery = useQuery({ queryKey: ['locations', 'provinces'], queryFn: getProvinces, staleTime: 10 * 60 * 1000 })

  function clearPasswords() {
    form.resetFields(['password', 'confirm_password'])
  }

  function rememberSocialConsent() {
    sessionStorage.setItem('employer_registration_consent', JSON.stringify({
      terms_accepted: termsAccepted,
      marketing_opt_in: marketingOptIn,
    }))
  }

  function mapApiErrors(err) {
    const data = err.response?.data
    if (!data || typeof data !== 'object') return false
    const fields = Object.entries(data)
      .filter(([name]) => REGISTRATION_FIELDS.has(name))
      .map(([name, messages]) => ({
        name,
        errors: Array.isArray(messages) ? messages.map(String) : [String(messages)],
      }))
    if (fields.length) form.setFields(fields)
    return fields.length > 0
  }

  async function goToEmployerDetails() {
    try {
      await form.validateFields(['terms_accepted', 'email', 'password', 'confirm_password'])
      setStep(2)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch {
      // Ant Design hiển thị lỗi ngay tại field không hợp lệ.
    }
  }

  function returnToAccount() {
    setStep(1)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function onFinish(values) {
    if (step === 1) {
      await goToEmployerDetails()
      return
    }
    if (!executeRecaptcha) {
      clearPasswords()
      setError('Captcha chưa sẵn sàng, vui lòng thử lại.')
      return
    }
    setError('')
    setLoading(true)
    try {
      const captchaToken = await executeRecaptcha('register')
      const result = await registerEmployer({
        email: values.email,
        password: values.password,
        full_name: values.full_name,
        gender: values.gender,
        contact_phone: values.contact_phone.replace(/[ .-]/g, ''),
        work_location: values.work_location,
        terms_accepted: values.terms_accepted,
        marketing_opt_in: Boolean(values.marketing_opt_in),
        captcha_token: captchaToken,
      })
      setCurrentUser(result.user)
      sessionStorage.removeItem('employer_registration_consent')
      navigate(`${EMPLOYER_ACCOUNT_VERIFY_URL}?registered=1`, { replace: true })
    } catch (err) {
      clearPasswords()
      const hasFieldErrors = mapApiErrors(err)
      if (err.response?.status === 429) {
        setError('Bạn thao tác quá nhanh, vui lòng thử lại sau ít phút.')
      } else if (!hasFieldErrors) {
        setError(getApiErrorMessage(err, 'Đăng ký thất bại. Vui lòng thử lại.'))
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="w-full">
      <AuthFormStyles />
      <header className="login-card mb-7 rounded-3xl border border-emerald-100 bg-[linear-gradient(135deg,#f0fdf4_0%,#ffffff_62%)] p-5 shadow-sm shadow-emerald-950/5 sm:p-7">
        <div className="flex items-start justify-between gap-5">
          <AuthLogo className="!mx-0 !h-12 !w-12 !rounded-xl" />
          <span className="rounded-full border border-emerald-200 bg-white/90 px-3 py-1.5 text-xs font-bold text-emerald-700">Chỉ mất khoảng 3 phút</span>
        </div>
        <p className="mt-7 text-xs font-black uppercase tracking-[0.16em] text-emerald-700">Không gian tuyển dụng cho doanh nghiệp</p>
        <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">Đăng ký tài khoản Nhà tuyển dụng</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
          Tạo tài khoản để quản lý ứng viên, thiết lập nhu cầu tuyển dụng và theo dõi hiệu quả trong một nơi.
        </p>
        <ol className="mt-6 grid grid-cols-2 gap-2" aria-label="Các bước tạo tài khoản">
          {REGISTRATION_STEPS.map((flowStep, index) => (
            <li key={flowStep.title} className={`flex items-center gap-3 rounded-xl border px-3 py-3 transition-colors ${index + 1 === step ? 'border-emerald-200 bg-white shadow-sm shadow-emerald-950/5' : 'border-transparent bg-white/50 text-slate-400'}`}>
              <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm ${index + 1 === step ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-400'}`}>{flowStep.icon}</span>
              <span><strong className={`block text-xs font-bold ${index + 1 === step ? 'text-slate-800' : 'text-slate-400'}`}>{String(index + 1).padStart(2, '0')} · {flowStep.title}</strong></span>
            </li>
          ))}
        </ol>
      </header>

      {error && <Alert type="error" message={error} showIcon closable onClose={() => setError('')} className="login-field mb-5 !rounded-lg" />}

      <Form
        form={form}
        layout="vertical"
        initialValues={{ marketing_opt_in: false }}
        onFinish={onFinish}
        requiredMark="optional"
        scrollToFirstError={{ behavior: 'smooth', block: 'center' }}
      >
        {step === 1 ? (
          <section className="login-field rounded-3xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-950/[0.03] sm:p-7">
            <RegistrationSectionTitle number="01" title="Tạo thông tin đăng nhập" description="Dùng email công ty nếu có để việc xác thực doanh nghiệp thuận lợi hơn." />
            <div className="rounded-2xl border border-emerald-100 bg-emerald-50/50 p-4">
              <p className="mb-3 text-sm font-semibold text-slate-700">Trước khi tiếp tục, vui lòng xác nhận lựa chọn của bạn</p>
              <EmployerConsentFields compact />
            </div>
            <div className="mt-5">
              <SocialLoginButtons
                portal="employer"
                action="Đăng ký"
                appearance="employer"
                disabled={!termsAccepted}
                next={EMPLOYER_COMPLETE_PROFILE_URL}
                onBeforeRedirect={rememberSocialConsent}
              />
              {!termsAccepted && <p className="mt-2 text-center text-xs text-slate-400">Đồng ý điều khoản để tiếp tục đăng ký bằng Google.</p>}
            </div>
            <div className="my-6 flex items-center gap-3"><div className="divider-line" /><span className="shrink-0 text-xs font-semibold uppercase tracking-widest text-slate-400">Hoặc dùng email</span><div className="divider-line" /></div>

            <div className="grid gap-x-5 md:grid-cols-2">
              <Form.Item
                name="email"
                label="Email đăng nhập"
                validateTrigger="onBlur"
                className="md:col-span-2"
                rules={[
                  { required: true, message: 'Vui lòng nhập email' },
                  { type: 'email', message: 'Email không hợp lệ' },
                  {
                    validator: async (_, value) => {
                      if (!value || !/^\S+@\S+\.\S+$/.test(value)) return
                      const available = await checkRegistrationEmail(value, { role: 'employer' })
                      if (!available) throw new Error('Email này đã được sử dụng cho một tài khoản nhà tuyển dụng')
                    },
                  },
                ]}
              >
                <Input autoComplete="email" prefix={<MailOutlined className="text-emerald-600" />} placeholder="hr@congty.vn" className="!h-12 !rounded-lg !text-base" />
              </Form.Item>
              <Form.Item name="password" label="Mật khẩu" rules={[{ required: true, message: 'Vui lòng nhập mật khẩu' }, { validator: passwordValidationRule }]} className="!mb-1">
                <Input.Password autoComplete="new-password" prefix={<LockOutlined className="text-emerald-600" />} placeholder="Nhập mật khẩu" className="!h-12 !rounded-lg !text-base" />
              </Form.Item>
              <Form.Item
                name="confirm_password"
                label="Nhập lại mật khẩu"
                dependencies={['password']}
                rules={[
                  { required: true, message: 'Vui lòng nhập lại mật khẩu' },
                  ({ getFieldValue }) => ({
                    validator: (_, value) => !value || getFieldValue('password') === value
                      ? Promise.resolve()
                      : Promise.reject(new Error('Mật khẩu nhập lại không khớp')),
                  }),
                ]}
              >
                <Input.Password autoComplete="new-password" prefix={<LockOutlined className="text-emerald-600" />} placeholder="Nhập lại mật khẩu" className="!h-12 !rounded-lg !text-base" />
              </Form.Item>
              <div className="md:col-span-2"><PasswordRequirements password={password} /></div>
            </div>

            <button type="button" onClick={goToEmployerDetails} className="submit-btn mt-6 flex w-full cursor-pointer items-center justify-center gap-2.5 rounded-xl px-6 py-4 text-base font-bold text-white">
              <span>Tiếp tục</span><ArrowRightOutlined />
            </button>
          </section>
        ) : (
          <section className="login-field rounded-3xl border border-slate-200 bg-white p-5 shadow-sm shadow-slate-950/[0.03] sm:p-7">
            <RegistrationSectionTitle number="02" title="Thông tin nhà tuyển dụng" description="Bổ sung người liên hệ; bạn sẽ tìm hoặc tạo đúng hồ sơ công ty ở bước xác thực riêng." />
            <EmployerRegistrationFields provinces={provincesQuery.data || []} locationsLoading={provincesQuery.isLoading} />
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <button type="button" onClick={returnToAccount} className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-slate-200 px-6 py-4 text-base font-bold text-slate-700 transition hover:border-emerald-300 hover:text-emerald-700"><ArrowLeftOutlined />Quay lại</button>
              <button type="submit" disabled={loading} className="submit-btn flex cursor-pointer items-center justify-center gap-2.5 rounded-xl px-6 py-4 text-base font-bold text-white disabled:cursor-not-allowed disabled:opacity-70">
                {loading ? 'Đang tạo tài khoản...' : <><span>Hoàn tất đăng ký</span><ArrowRightOutlined /></>}
              </button>
            </div>
          </section>
        )}
      </Form>

      <p className="login-field mt-6 text-center text-sm text-slate-500">
        Đã có tài khoản?{' '}
        <Link to={employerAppPath('/login')} className="font-semibold !text-emerald-700 hover:underline">Đăng nhập ngay</Link>
      </p>
    </div>
  )
}
