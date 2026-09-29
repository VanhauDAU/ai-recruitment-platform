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
} from '@/entities/employer-profile'
import { useSession } from '@/entities/session'
import { settingText, useSiteSettings } from '@/entities/site-settings'
import { getApiErrorMessage } from '@/shared/api/error-mapper'
import {
  EMPLOYER_PASSWORD_SETTINGS_URL,
  EMPLOYER_PHONE_VERIFY_URL,
} from '@/shared/config/portals'
import { message } from '@/shared/lib/toast'
import { getPasswordSetupFromPhoneUrl } from '../model/phone-verification-navigation'
import { isVietnameseMobile } from '../model/vietnamese-mobile'
import EmployerPhoneChallengeForm from './EmployerPhoneChallengeForm'

const BANNER_SRC = '/images/employer/phone-verify-banner.png'
const PASSWORD_SETTINGS_FROM_PHONE_URL = getPasswordSetupFromPhoneUrl(
  EMPLOYER_PASSWORD_SETTINGS_URL,
  EMPLOYER_PHONE_VERIFY_URL,
)
const ACTIVE_DISPATCH_STATES = new Set(['queued', 'dispatching', 'retry_pending'])

const BENEFITS = [
  {
    icon: SafetyCertificateOutlined,
    text: 'Tăng cường bảo mật tài khoản nhà tuyển dụng, chống giả mạo và chiếm quyền sử dụng.',
  },
  {
    icon: RiseOutlined,
    text: 'Nâng cao mức độ tin cậy của thương hiệu tuyển dụng với ứng viên.',
  },
  {
    icon: CustomerServiceOutlined,
    text: 'Giúp đội ngũ hỗ trợ xác minh chủ tài khoản nhanh hơn khi có sự cố.',
  },
]

function VerificationBanner() {
  return (
    <img
      src={BANNER_SRC}
      alt="Xác thực số điện thoại nhà tuyển dụng"
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
  const hotline = settingText(settings.hotline, '1900 1234')
  const supportEmail = settingText(settings.support_email, 'cskh@procv.vn')
  const phoneValue = (Form.useWatch('phone', form) || '').trim()
  const validPhone = isVietnameseMobile(phoneValue)

  const sendMutation = useMutation({
    mutationFn: ({ phone, password }) => sendEmployerPhoneOtp(phone, password),
    onSuccess: (data) => {
      setChallenge(data)
      setPasswordOpen(false)
      passwordForm.resetFields()
      form.setFieldValue('code', '')
      message.success('Yêu cầu gửi mã SMS đã được tiếp nhận.')
    },
    onError: (error) => message.error(getApiErrorMessage(error, 'Không thể gửi mã SMS.')),
  })
  const verifyMutation = useMutation({
    mutationFn: ({ code }) => verifyEmployerPhoneOtp(challenge.public_id, code),
    onSuccess: async () => {
      message.success(
        flowMode === 'phone_change'
          ? 'Số điện thoại mới đã được xác thực.'
          : 'Số điện thoại đã được xác thực.',
      )
      setChallenge(null)
      setFlowMode(null)
      await Promise.all([
        profileQuery.refetch(),
        refreshSession(),
        queryClient.invalidateQueries({ queryKey: ['employer-dashboard'] }),
      ])
    },
    onError: (error) => message.error(getApiErrorMessage(error, 'Mã xác thực không hợp lệ.')),
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
            message="Không thể tải trạng thái xác thực"
            action={<Button onClick={() => profileQuery.refetch()}>Thử lại</Button>}
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
            title="Số điện thoại đã được xác thực"
            subTitle={verifiedPhone}
            extra={[
              <Button
                key="change"
                type="primary"
                onClick={() => {
                  setFlowMode('phone_change')
                  form.setFieldsValue({ phone: '', code: '' })
                }}
              >
                Đổi số điện thoại
              </Button>,
              <Button
                key="reverify"
                onClick={() => {
                  setFlowMode('reverify')
                  form.setFieldsValue({ phone: verifiedPhone, code: '' })
                  setPasswordOpen(true)
                }}
              >
                Xác minh lại
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
            message="Tài khoản chưa có mật khẩu đăng nhập"
            description={(
              <span>
                Vui lòng{' '}
                <Link to={PASSWORD_SETTINGS_FROM_PHONE_URL} className="font-bold">
                  cập nhật mật khẩu tại đây
                </Link>{' '}
                trước khi xác thực số điện thoại. Hỗ trợ: {hotline} · {supportEmail}.
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
                ? 'Đổi số điện thoại đã xác thực'
                : flowMode === 'reverify'
                  ? 'Xác minh lại số điện thoại'
                  : 'Xác thực số điện thoại'}
            </h2>
            <p className="mt-1 text-sm leading-6 text-slate-500">
              Mã xác thực được gửi trực tiếp qua SMS và không được gửi qua email.
            </p>
          </div>
          {alreadyVerified && (
            <Button onClick={resetFlow}>Quay lại</Button>
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
          <p className="font-semibold text-slate-800">Lưu ý bảo mật:</p>
          <ul className="mt-2 space-y-1.5 text-sm leading-6 text-slate-500">
            <li>Mỗi mã chỉ dùng được cho đúng yêu cầu SMS vừa tạo và hết hạn sau 10 phút.</li>
            <li>Gửi mã mới sẽ vô hiệu mã cũ; không chia sẻ mã với bất kỳ ai.</li>
            <li>Đổi số không làm mất xác thực hiện tại cho tới khi số mới được xác thực thành công.</li>
          </ul>
        </div>

        <div className="mt-8">
          <p className="font-semibold text-slate-800">Lợi ích khi xác thực số điện thoại:</p>
          <div className="mt-4 grid gap-5 sm:grid-cols-2">
            {BENEFITS.map(({ icon: Icon, text }) => (
              <div key={text} className="flex gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-lg text-emerald-600">
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
