import { ArrowLeftOutlined, ArrowRightOutlined, DownOutlined, InfoCircleOutlined, LockOutlined, MailOutlined, PhoneOutlined, UpOutlined } from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import { Alert, Form, Input } from 'antd'
import { useState } from 'react'
import { useGoogleReCaptcha } from 'react-google-recaptcha-v3'
import { Link, useNavigate } from 'react-router'
import {
  AuthFormStyles,
  AuthLogo,
  checkRegistrationEmail,
  employerPasswordValidationRule,
  PasswordRequirements,
  registerEmployer,
  RegistrationClosedNotice,
  SocialLoginButtons,
} from '@/features/common/account/auth'
import { EmployerConsentFields, EmployerRegistrationFields } from '@/features/employer/account/complete-employer-registration'
import { getProvinces } from '@/entities/system/location'
import { useSession } from '@/entities/account/session'
import { settingText, useSiteSettings } from '@/entities/system/site-settings'
import { getApiErrorMessage } from '@/shared/api/error-mapper'
import { EMPLOYER_ACCOUNT_VERIFY_URL, EMPLOYER_COMPLETE_PROFILE_URL, employerAppPath } from '@/shared/config/portals'
import { toastSoundOptions } from '@/shared/lib/sound-effects'
import { message } from '@/shared/lib/toast'
import { shouldSubmitRegistrationOnEnter } from './registration-keyboard'
import { m } from '@/shared/config/i18n'

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
    <section className="login-field mb-7 overflow-hidden rounded-xl border border-[var(--brand-primary)] bg-white" aria-labelledby="registration-rules-title">
      <button
        type="button"
        aria-controls="registration-rules-content"
        aria-expanded={expanded}
        onClick={onToggle}
        className="flex min-h-12 w-full cursor-pointer items-center justify-between gap-4 px-4 py-3 text-left text-[var(--brand-primary-hover)] transition-colors hover:bg-[var(--brand-primary-soft)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--brand-primary)] sm:px-5"
      >
        <span id="registration-rules-title" className="text-base font-bold">{m.employer_account_register_rules_title()}</span>
        <span className="flex shrink-0 items-center gap-2 text-sm font-semibold">
          {expanded ? <UpOutlined aria-hidden="true" /> : <DownOutlined aria-hidden="true" />}
        </span>
      </button>

      {expanded && (
        <div id="registration-rules-content" className="border-t border-[var(--brand-primary)]/20 px-4 pb-5 pt-4 text-sm leading-6 text-slate-600 sm:px-5">
          <p>
            {m.employer_account_register_rules_1_before()}<strong className="font-semibold text-slate-800">{siteName}</strong>{m.employer_account_register_rules_1_after()}
          </p>
          <p className="mt-3">
            {m.employer_account_register_rules_2({ siteName })}
          </p>
          <p className="mt-3">
            {m.employer_account_register_rules_3({ siteName })}
          </p>
          {hotline && (
            <p className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-1 font-medium text-slate-700">
              <PhoneOutlined className="text-[var(--brand-primary)]" aria-hidden="true" />
              {m.employer_account_register_rules_hotline()}
              <a href={phoneHref} className="font-bold !text-[var(--brand-primary-hover)] hover:underline">{hotline}</a>
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
    if (!data || typeof data !== 'object') return { hasErrors: false, step: null }
    const fields = Object.entries(data)
      .filter(([name]) => REGISTRATION_FIELDS.has(name))
      .map(([name, messages]) => ({
        name,
        errors: Array.isArray(messages) ? messages.map(String) : [String(messages)],
      }))
    if (fields.length) form.setFields(fields)
    return {
      hasErrors: fields.length > 0,
      step: fields.some(({ name }) => (
        ['terms_accepted', 'email', 'password'].includes(name)
      )) ? 1 : fields.length ? 2 : null,
    }
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

  function submitOnEnter(event) {
    if (!shouldSubmitRegistrationOnEnter(event)) return
    event.preventDefault()
    form.submit()
  }

  async function onFinish(submittedValues) {
    if (step === 1) {
      await goToEmployerDetails()
      return
    }
    // Ant Design only includes currently mounted Form.Item values in
    // onFinish. Step 1 is unmounted here, so explicitly include preserved
    // values such as email, password and terms acceptance.
    const values = {
      ...form.getFieldsValue(true),
      ...submittedValues,
    }
    if (!executeRecaptcha) {
      clearPasswords()
      setStep(1)
      setError(m.employer_account_register_captcha_not_ready())
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
      message.success(m.employer_account_register_success(), toastSoundOptions('done'))
      sessionStorage.removeItem('employer_registration_consent')
      navigate(`${EMPLOYER_ACCOUNT_VERIFY_URL}?registered=1`, { replace: true })
    } catch (err) {
      const apiErrors = mapApiErrors(err)
      if (apiErrors.step) setStep(apiErrors.step)
      if (err.response?.status === 429) {
        setError(m.employer_account_register_rate_limited())
      } else if (!apiErrors.hasErrors) {
        setError(getApiErrorMessage(err, m.employer_account_register_failed()))
      }
    } finally {
      setLoading(false)
    }
  }

  if (settings.employer_allow_registration === false) {
    return (
      <div className="w-full">
        <AuthLogo className="!mx-0 mb-4 !h-12 !w-12 !rounded-xl" />
        <RegistrationClosedNotice loginPath={employerAppPath('/login')} />
      </div>
    )
  }

  return (
    <div className="w-full">
      <AuthFormStyles />
      <header className="login-card mb-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <AuthLogo className="!mx-0 !h-12 !w-12 !rounded-xl" />
          <span className="rounded-full bg-[var(--brand-primary-soft)] px-3 py-1.5 text-xs font-bold text-[var(--brand-primary-hover)]">{m.employer_account_register_badge()}</span>
        </div>
        <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">{m.employer_account_register_title()}</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
          {m.employer_account_register_subtitle()}
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
        onKeyDown={submitOnEnter}
        onFinish={onFinish}
        requiredMark="optional"
        scrollToFirstError={{ behavior: 'smooth', block: 'center' }}
      >
        {step === 1 ? (
          <section className="login-field">
            <RegistrationSectionTitle title={m.employer_account_register_step1_title()} description={m.employer_account_register_step1_desc()} />
            <div className="border-b border-slate-100 pb-5">
              <p className="mb-3 text-sm font-semibold text-slate-700">{m.employer_account_register_consent_prompt()}</p>
              <EmployerConsentFields compact />
            </div>
            <div className="mt-5">
              <SocialLoginButtons
                portal="employer"
                action={m.account_social_action_register()}
                appearance="employer"
                disabled={!termsAccepted}
                next={EMPLOYER_COMPLETE_PROFILE_URL}
                onBeforeRedirect={rememberSocialConsent}
              />
              {!termsAccepted && <p className="mt-2 text-center text-xs text-slate-400">{m.employer_account_register_terms_for_google()}</p>}
            </div>
            <div className="my-6 flex items-center gap-3"><div className="divider-line" /><span className="shrink-0 text-xs font-semibold uppercase tracking-widest text-slate-400">{m.employer_account_register_or_email()}</span><div className="divider-line" /></div>

            <div className="grid gap-x-5 md:grid-cols-2">
              <Form.Item
                name="email"
                label={m.employer_account_register_email_label()}
                validateTrigger="onBlur"
                className="md:col-span-2"
                rules={[
                  { required: true, message: m.employer_account_register_email_required() },
                  { type: 'email', message: m.employer_account_register_email_invalid() },
                  {
                    validator: async (_, value) => {
                      if (!value || !/^\S+@\S+\.\S+$/.test(value)) return
                      const available = await checkRegistrationEmail(value, { role: 'employer' })
                      if (!available) throw new Error(m.employer_account_register_email_taken())
                    },
                  },
                ]}
              >
                <Input autoFocus autoComplete="email" prefix={<MailOutlined className="text-[var(--brand-primary)]" />} placeholder="hr@congty.vn" className="!h-12 !rounded-lg !text-base" />
              </Form.Item>
              <p className="-mt-3 mb-5 flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2.5 text-xs leading-5 text-amber-900 md:col-span-2">
                <InfoCircleOutlined className="mt-0.5 shrink-0 text-amber-600" aria-hidden="true" />
                <span>{m.employer_account_register_domain_warning()}</span>
              </p>
              <Form.Item name="password" label={m.employer_account_register_password_label()} rules={[{ required: true, message: m.employer_account_register_password_required() }, { validator: employerPasswordValidationRule }]} className="!mb-1">
                <Input.Password
                  autoComplete="new-password"
                  prefix={<LockOutlined className="text-[var(--brand-primary)]" />}
                  placeholder={m.employer_account_register_password_placeholder()}
                  className="!h-12 !rounded-lg !text-base"
                  onFocus={() => setPasswordFocused(true)}
                  onBlur={() => setPasswordFocused(false)}
                />
              </Form.Item>
              <Form.Item
                name="confirm_password"
                label={m.employer_account_register_confirm_label()}
                dependencies={['password']}
                rules={[
                  { required: true, message: m.employer_account_register_confirm_required() },
                  ({ getFieldValue }) => ({
                    validator: (_, value) => !value || getFieldValue('password') === value
                      ? Promise.resolve()
                      : Promise.reject(new Error(m.employer_account_register_password_mismatch())),
                  }),
                ]}
              >
                <Input.Password autoComplete="new-password" prefix={<LockOutlined className="text-[var(--brand-primary)]" />} placeholder={m.employer_account_register_confirm_label()} className="!h-12 !rounded-lg !text-base" />
              </Form.Item>
              {passwordFocused && <div className="md:col-span-2"><PasswordRequirements password={password} mode="employer" /></div>}
            </div>

            <button type="submit" className="submit-btn mt-6 flex w-full cursor-pointer items-center justify-center gap-2.5 rounded-xl px-6 py-4 text-base font-bold text-white">
              <span>{m.employer_account_register_continue()}</span><ArrowRightOutlined />
            </button>
          </section>
        ) : (
          <section className="login-field">
            <RegistrationSectionTitle title={m.employer_account_register_step2_title()} description={m.employer_account_register_step2_desc()} />
            <EmployerRegistrationFields provinces={provincesQuery.data || []} locationsLoading={provincesQuery.isLoading} />
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <button type="button" onClick={returnToAccount} className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-slate-200 px-6 py-4 text-base font-bold text-slate-700 transition hover:border-[var(--brand-primary)]/40 hover:text-[var(--brand-primary-hover)]"><ArrowLeftOutlined />{m.employer_account_register_back()}</button>
              <button type="submit" disabled={loading} className="submit-btn flex cursor-pointer items-center justify-center gap-2.5 rounded-xl px-6 py-4 text-base font-bold text-white disabled:cursor-not-allowed disabled:opacity-70">
                {loading ? m.employer_account_register_submitting() : <><span>{m.employer_account_register_submit()}</span><ArrowRightOutlined /></>}
              </button>
            </div>
          </section>
        )}
      </Form>

      <p className="login-field mt-6 text-center text-sm text-slate-500">
        {m.employer_account_register_have_account()}{' '}
        <Link to={employerAppPath('/login')} className="font-semibold !text-[var(--brand-primary-hover)] hover:underline">{m.employer_account_register_login_now()}</Link>
      </p>
    </div>
  )
}
