import { ArrowLeftOutlined, ArrowRightOutlined, DownOutlined, InfoCircleOutlined, LockOutlined, MailOutlined, PhoneOutlined, UpOutlined } from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import { Alert, Form, Input } from 'antd'
import { useState } from 'react'
import { useGoogleReCaptcha } from 'react-google-recaptcha-v3'
import { Link, useNavigate } from 'react-router-dom'
import {
  AuthFormStyles,
  AuthLogo,
  checkRegistrationEmail,
  employerPasswordValidationRule,
  PasswordRequirements,
  registerEmployer,
  SocialLoginButtons,
} from '@/features/auth'
import { EmployerConsentFields, EmployerRegistrationFields } from '@/features/complete-employer-registration'
import { getProvinces } from '@/entities/location'
import { useSession } from '@/entities/session'
import { settingText, useSiteSettings } from '@/entities/site-settings'
import { getApiErrorMessage } from '@/shared/api/error-mapper'
import { EMPLOYER_ACCOUNT_VERIFY_URL, EMPLOYER_COMPLETE_PROFILE_URL, employerAppPath } from '@/shared/config/portals'

const REGISTRATION_FIELDS = new Set([
  'email', 'password', 'full_name', 'gender', 'contact_phone',
  'work_location', 'terms_accepted', 'marketing_opt_in',
])

function RegistrationSectionTitle({ title, description }) {
  return (
    <div className="mb-6 border-b border-slate-100 pb-4">
      <h2 className="text-lg font-black tracking-tight text-slate-900 sm:text-xl">{title}</h2>
      <p className="mt-1 text-sm leading-6 text-slate-500">{description}</p>
    </div>
  )
}

function RegistrationRules({ expanded, hotline, onToggle, siteName }) {
  const phoneHref = hotline ? `tel:${hotline.replace(/[^\d+]/g, '')}` : undefined

  return (
    <section className="login-field mb-7 overflow-hidden rounded-xl border border-emerald-400 bg-white" aria-labelledby="registration-rules-title">
      <button
        type="button"
        aria-controls="registration-rules-content"
        aria-expanded={expanded}
        onClick={onToggle}
        className="flex min-h-12 w-full cursor-pointer items-center justify-between gap-4 px-4 py-3 text-left text-emerald-700 transition-colors hover:bg-emerald-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-emerald-600 sm:px-5"
      >
        <span id="registration-rules-title" className="text-base font-bold">Quy định</span>
        <span className="flex shrink-0 items-center gap-2 text-sm font-semibold">
          {expanded ? <UpOutlined aria-hidden="true" /> : <DownOutlined aria-hidden="true" />}
        </span>
      </button>

      {expanded && (
        <div id="registration-rules-content" className="border-t border-emerald-100 px-4 pb-5 pt-4 text-sm leading-6 text-slate-600 sm:px-5">
          <p>
            Để đảm bảo chất lượng dịch vụ, <strong className="font-semibold text-slate-800">{siteName}</strong> không cho phép một người dùng tạo nhiều tài khoản nhà tuyển dụng khác nhau.
          </p>
          <p className="mt-3">
            Nếu phát hiện vi phạm, {siteName} có thể ngừng cung cấp dịch vụ tới các tài khoản trùng lặp hoặc tạm chặn quyền truy cập hệ thống để xác minh.
          </p>
          <p className="mt-3">
            Sau khi đăng ký và cung cấp đầy đủ thông tin cần thiết, nhà tuyển dụng có thể được hỗ trợ hiển thị tin tuyển dụng cơ bản. Số lượng tin đăng và cách thức hiển thị phụ thuộc vào quy định của {siteName} tại từng thời điểm.
          </p>
          {hotline && (
            <p className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-1 font-medium text-slate-700">
              <PhoneOutlined className="text-emerald-600" aria-hidden="true" />
              Cần hỗ trợ? Liên hệ hotline
              <a href={phoneHref} className="font-bold !text-emerald-700 hover:!text-emerald-800 hover:underline">{hotline}</a>
            </p>
          )}
        </div>
      )}
    </section>
  )
}

export default function EmployerRegister() {
  const navigate = useNavigate()
  const { setCurrentUser } = useSession()
  const { settings, siteName } = useSiteSettings()
  const { executeRecaptcha } = useGoogleReCaptcha()
  const [form] = Form.useForm()
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [step, setStep] = useState(1)
  const [rulesExpanded, setRulesExpanded] = useState(true)
  const [passwordFocused, setPasswordFocused] = useState(false)
  const hotline = settingText(settings.hotline)
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
      <header className="login-card mb-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <AuthLogo className="!mx-0 !h-12 !w-12 !rounded-xl" />
          <span className="rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700">Chỉ mất khoảng 3 phút</span>
        </div>
        <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">Đăng ký tài khoản Nhà tuyển dụng</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
          Tạo tài khoản để quản lý ứng viên, thiết lập nhu cầu tuyển dụng và theo dõi hiệu quả trong một nơi.
        </p>
      </header>

      <RegistrationRules
        expanded={rulesExpanded}
        hotline={hotline}
        onToggle={() => setRulesExpanded((current) => !current)}
        siteName={siteName}
      />

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
          <section className="login-field">
            <RegistrationSectionTitle title="Tạo thông tin đăng nhập" description="Dùng email công ty nếu có để việc xác thực doanh nghiệp thuận lợi hơn." />
            <div className="border-b border-slate-100 pb-5">
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
              <p className="-mt-3 mb-5 flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2.5 text-xs leading-5 text-amber-900 md:col-span-2">
                <InfoCircleOutlined className="mt-0.5 shrink-0 text-amber-600" aria-hidden="true" />
                <span>Trường hợp bạn đăng ký tài khoản bằng email không phải email tên miền công ty, một số dịch vụ trên tài khoản có thể sẽ bị giới hạn quyền mua hoặc sử dụng.</span>
              </p>
              <Form.Item name="password" label="Mật khẩu" rules={[{ required: true, message: 'Vui lòng nhập mật khẩu' }, { validator: employerPasswordValidationRule }]} className="!mb-1">
                <Input.Password
                  autoComplete="new-password"
                  prefix={<LockOutlined className="text-emerald-600" />}
                  placeholder="Nhập mật khẩu"
                  className="!h-12 !rounded-lg !text-base"
                  onFocus={() => setPasswordFocused(true)}
                  onBlur={() => setPasswordFocused(false)}
                />
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
              {passwordFocused && <div className="md:col-span-2"><PasswordRequirements password={password} mode="employer" /></div>}
            </div>

            <button type="button" onClick={goToEmployerDetails} className="submit-btn mt-6 flex w-full cursor-pointer items-center justify-center gap-2.5 rounded-xl px-6 py-4 text-base font-bold text-white">
              <span>Tiếp tục</span><ArrowRightOutlined />
            </button>
          </section>
        ) : (
          <section className="login-field">
            <RegistrationSectionTitle title="Thông tin nhà tuyển dụng" description="Bổ sung người liên hệ; bạn sẽ tìm hoặc tạo đúng hồ sơ công ty ở bước xác thực riêng." />
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
