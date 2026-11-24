import {
  CheckCircleFilled,
  CustomerServiceOutlined,
  RiseOutlined,
  SafetyCertificateOutlined,
} from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Alert, Button, Form, Result, Skeleton } from 'antd'
import { useState } from 'react'
import { Link } from 'react-router'
import {
  employerProfileKeys,
  getEmployerPhoneChallenge,
  getEmployerProfile,
  sendEmployerPhoneOtp,
  verifyEmployerPhoneOtp,
} from '@/entities/account/employer-profile'
import { useSession } from '@/entities/account/session'
import { DEFAULT_SITE_SETTINGS, settingText, useSiteSettings } from '@/entities/system/site-settings'
import { getApiErrorMessage } from '@/shared/api/error-mapper'
import {
  EMPLOYER_ACCOUNT_VERIFY_URL,
  EMPLOYER_PASSWORD_SETTINGS_URL,
  EMPLOYER_PHONE_VERIFY_URL,
} from '@/shared/config/portals'
import { message } from '@/shared/lib/toast'
import { getPasswordSetupFromPhoneUrl } from '../model/phone-verification-navigation'
import { isVietnameseMobile } from '../model/vietnamese-mobile'
import EmployerPhoneChallengeForm from './EmployerPhoneChallengeForm'
import { m } from '@/shared/config/i18n'

const BANNER_SRC = '/images/employer/phone-verify-banner.png'
const PASSWORD_SETTINGS_FROM_PHONE_URL = getPasswordSetupFromPhoneUrl(
  EMPLOYER_PASSWORD_SETTINGS_URL,
  EMPLOYER_PHONE_VERIFY_URL,
)
const ACTIVE_DISPATCH_STATES = new Set(['queued', 'dispatching', 'retry_pending'])

const BENEFITS = [
  {
    icon: SafetyCertificateOutlined,
    text: m.employer_account_phone_benefit_security(),
  },
  {
    icon: RiseOutlined,
    text: m.employer_account_phone_benefit_trust(),
  },
  {
    icon: CustomerServiceOutlined,
    text: m.employer_account_phone_benefit_support(),
  },
]

function VerificationBanner() {
  return (
    <img
      src={BANNER_SRC}
      alt={m.employer_account_phone_banner_alt()}
      className="block w-full"
      loading="lazy"
    />
  )
}

export default function EmployerPhoneVerification() {
  const { user, refreshSession } = useSession()
  const { settings } = useSiteSettings()
  const queryClient = useQueryClient()
  const [form] = Form.useForm()
  const [passwordForm] = Form.useForm()
  const [challenge, setChallenge] = useState(null)
  const [flowMode, setFlowMode] = useState(null)
  const [passwordOpen, setPasswordOpen] = useState(false)

  const profileQuery = useQuery({
    queryKey: employerProfileKeys.profile,
    queryFn: getEmployerProfile,
  })
  const challengeQuery = useQuery({
    queryKey: employerProfileKeys.phoneChallenge(challenge?.public_id),
    queryFn: () => getEmployerPhoneChallenge(challenge.public_id),
    enabled: Boolean(challenge?.public_id),
    refetchInterval: (query) => (
      ACTIVE_DISPATCH_STATES.has(query.state.data?.status || challenge?.status)
        ? 1500
        : false
    ),
  })
  const currentChallenge = challengeQuery.data || challenge
  const canVerify = currentChallenge?.can_verify === true
  const hotline = settingText(settings.hotline, DEFAULT_SITE_SETTINGS.hotline)
  const supportEmail = settingText(settings.support_email, DEFAULT_SITE_SETTINGS.support_email)
  const phoneValue = (Form.useWatch('phone', form) || '').trim()
  const validPhone = isVietnameseMobile(phoneValue)

  const sendMutation = useMutation({
    mutationFn: ({ phone, password }) => sendEmployerPhoneOtp(phone, password),
    onSuccess: (data) => {
      setChallenge(data)
      setPasswordOpen(false)
      passwordForm.resetFields()
      form.setFieldValue('code', '')
      message.success(m.employer_account_phone_send_accepted())
    },
    onError: (error) => message.error(getApiErrorMessage(error, m.employer_account_phone_send_failed())),
  })
  const verifyMutation = useMutation({
    mutationFn: ({ code }) => verifyEmployerPhoneOtp(challenge.public_id, code),
    onSuccess: async () => {
      message.success(
        flowMode === 'phone_change'
          ? m.employer_account_phone_new_verified()
          : m.employer_account_phone_verified_toast(),
      )
      // Load the verified state first: resetting the flow before the profile
      // refreshes showed the empty verification form again for a moment.
      await Promise.all([
        profileQuery.refetch(),
        refreshSession(),
        queryClient.invalidateQueries({ queryKey: ['employer-dashboard'] }),
        queryClient.invalidateQueries({ queryKey: ['employer', 'profile'] }),
      ])
      setChallenge(null)
      setFlowMode(null)
    },
    onError: (error) => message.error(getApiErrorMessage(error, m.employer_account_phone_invalid_code())),
  })

  const submitPassword = async () => {
    const { password } = await passwordForm.validateFields()
    sendMutation.mutate({ phone: phoneValue, password })
  }
  const resetFlow = () => {
    setChallenge(null)
    setFlowMode(null)
    setPasswordOpen(false)
    form.resetFields()
    passwordForm.resetFields()
  }

  if (profileQuery.isLoading) {
    return (
      <>
        <VerificationBanner />
        <div className="p-5 sm:p-8"><Skeleton active paragraph={{ rows: 8 }} /></div>
      </>
    )
  }
  if (profileQuery.isError) {
    return (
      <>
        <VerificationBanner />
        <div className="p-5 sm:p-8">
          <Alert
            type="error"
            showIcon
            message={m.employer_account_phone_load_failed()}
            action={<Button onClick={() => profileQuery.refetch()}>{m.employer_account_domain_retry()}</Button>}
          />
        </div>
      </>
    )
  }

  const profile = profileQuery.data || {}
  const verifiedPhone = profile.verified_phone || profile.contact_phone || ''
  const alreadyVerified = Boolean(profile.onboarding?.phone_verified)
  if (alreadyVerified && !flowMode) {
    return (
      <>
        <VerificationBanner />
        <div className="p-5 sm:p-8">
          <Result
            status="success"
            icon={<CheckCircleFilled className="text-emerald-500" />}
            title={m.employer_account_phone_verified_title()}
            subTitle={verifiedPhone}
            extra={[
              <Link key="continue" to={EMPLOYER_ACCOUNT_VERIFY_URL}>
                <Button type="primary">{m.employer_account_phone_continue_verification()}</Button>
              </Link>,
              <Button
                key="change"
                onClick={() => {
                  setFlowMode('phone_change')
                  form.setFieldsValue({ phone: '', code: '' })
                }}
              >
                {m.employer_account_phone_change()}
              </Button>,
              <Button
                key="reverify"
                onClick={() => {
                  setFlowMode('reverify')
                  form.setFieldsValue({ phone: verifiedPhone, code: '' })
                  setPasswordOpen(true)
                }}
              >
                {m.employer_account_phone_reverify()}
              </Button>,
            ]}
          />
        </div>
      </>
    )
  }
  if (!user?.has_usable_password) {
    return (
      <>
        <VerificationBanner />
        <div className="p-5 sm:p-8">
          <Alert
            type="warning"
            showIcon
            message={m.account_password_no_password_title()}
            description={(
              <span>
                {m.employer_account_phone_no_password_before()}{' '}
                <Link to={PASSWORD_SETTINGS_FROM_PHONE_URL} className="font-bold">
                  {m.employer_account_phone_no_password_link()}
                </Link>{' '}
                {m.employer_account_phone_no_password_after({ hotline, supportEmail })}
              </span>
            )}
          />
        </div>
      </>
    )
  }

  return (
    <>
      <VerificationBanner />
      <div className="p-5 sm:p-8">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-xl font-black text-slate-900">
              {flowMode === 'phone_change'
                ? m.employer_account_phone_title_change()
                : flowMode === 'reverify'
                  ? m.employer_account_phone_title_reverify()
                  : m.employer_account_phone_title()}
            </h2>
            <p className="mt-1 text-sm leading-6 text-slate-500">
              {m.employer_account_phone_subtitle()}
            </p>
          </div>
          {alreadyVerified && (
            <Button onClick={resetFlow}>{m.employer_account_register_back()}</Button>
          )}
        </div>

        <EmployerPhoneChallengeForm
          form={form}
          passwordForm={passwordForm}
          flowMode={flowMode}
          initialPhone={flowMode === 'reverify'
            ? verifiedPhone
            : profile.contact_phone || user?.phone || ''}
          phoneValue={phoneValue}
          validPhone={validPhone}
          challenge={currentChallenge}
          challengeError={challengeQuery.isError}
          canVerify={canVerify}
          passwordOpen={passwordOpen}
          sendPending={sendMutation.isPending}
          verifyPending={verifyMutation.isPending}
          onOpenPassword={() => setPasswordOpen(true)}
          onClosePassword={() => {
            setPasswordOpen(false)
            passwordForm.resetFields()
          }}
          onSubmitPassword={submitPassword}
          onVerify={(values) => verifyMutation.mutate(values)}
          onClearChallenge={() => setChallenge(null)}
        />

        <div className="mt-8 border-t border-slate-100 pt-6">
          <p className="font-semibold text-slate-800">{m.employer_account_phone_security_notes()}</p>
          <ul className="mt-2 space-y-1.5 text-sm leading-6 text-slate-500">
            <li>{m.employer_account_phone_note_1()}</li>
            <li>{m.employer_account_phone_note_2()}</li>
            <li>{m.employer_account_phone_note_3()}</li>
          </ul>
        </div>

        <div className="mt-8">
          <p className="font-semibold text-slate-800">{m.employer_account_phone_benefits_title()}</p>
          <div className="mt-4 grid gap-5 sm:grid-cols-2">
            {BENEFITS.map(({ icon: Icon, text }) => (
              <div key={text} className="flex gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[var(--brand-primary-soft)] text-lg text-[var(--brand-primary)]">
                  <Icon />
                </span>
                <p className="text-sm leading-6 text-slate-600">{text}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

    </>
  )
}
