import {
  CheckCircleFilled,
  CustomerServiceOutlined,
  LoadingOutlined,
  LockOutlined,
  PhoneOutlined,
  RiseOutlined,
  SafetyCertificateOutlined,
} from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Alert, App, Button, Form, Input, Modal, Result, Skeleton } from 'antd'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  checkEmployerPhoneAvailability,
  getEmployerProfile,
  sendEmployerPhoneOtp,
  verifyEmployerPhoneOtp,
} from '@/entities/employer-profile'
import { useSession } from '@/entities/session'
import { settingText, useSiteSettings } from '@/entities/site-settings'
import { getApiErrorMessage } from '@/shared/api/error-mapper'
import { EMPLOYER_PASSWORD_SETTINGS_URL } from '@/shared/config/portals'
import useDebouncedValue from '@/shared/hooks/use-debounced-value'

const BANNER_SRC = '/images/employer/phone-verify-banner.png'
const PHONE_PATTERN = /^(0|\+84)\d{9,10}$/

const BENEFITS = [
  {
    icon: SafetyCertificateOutlined,
    text: 'Tăng cường bảo mật tài khoản nhà tuyển dụng, chống kẻ xấu giả mạo và lợi dụng tài khoản.',
  },
  {
    icon: RiseOutlined,
    text: 'Nâng cao mức độ uy tín của thương hiệu tuyển dụng, tăng khả năng hiển thị tin tuyển dụng với ứng viên phù hợp, tăng tỷ lệ hồ sơ ứng tuyển.',
  },
  {
    icon: CustomerServiceOutlined,
    text: 'Được đội ngũ hỗ trợ nhanh chóng qua số điện thoại đã xác thực khi có vấn đề phát sinh, rút ngắn tối đa thời gian xử lý thắc mắc, khiếu nại.',
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
  const { message } = App.useApp()
  const queryClient = useQueryClient()
  const [form] = Form.useForm()
  const [passwordForm] = Form.useForm()
  const [otpSent, setOtpSent] = useState(false)
  const [passwordOpen, setPasswordOpen] = useState(false)

  const profileQuery = useQuery({ queryKey: ['employer', 'profile'], queryFn: getEmployerProfile })
  const hotline = settingText(settings.hotline, '1900 1234')
  const supportEmail = settingText(settings.support_email, 'cskh@procv.vn')

  const phoneValue = (Form.useWatch('phone', form) || '').trim()
  const debouncedPhone = useDebouncedValue(phoneValue, 500)
  const isValidPhone = PHONE_PATTERN.test(debouncedPhone)
  const availabilityQuery = useQuery({
    queryKey: ['employer', 'phone-check', debouncedPhone],
    queryFn: () => checkEmployerPhoneAvailability(debouncedPhone),
    enabled: isValidPhone && !otpSent,
    staleTime: 30_000,
  })
  const isChecking = isValidPhone && availabilityQuery.isFetching
  const isTaken = availabilityQuery.data?.available === false
  const isAvailable = availabilityQuery.data?.available === true

  const sendMutation = useMutation({
    mutationFn: ({ phone, password }) => sendEmployerPhoneOtp(phone, password),
    onSuccess: () => {
      setOtpSent(true)
      setPasswordOpen(false)
      passwordForm.resetFields()
      message.success('Mã xác thực đã được gửi tới email tài khoản.')
    },
    onError: (error) => message.error(getApiErrorMessage(error, 'Không thể gửi mã xác thực.')),
  })
  const verifyMutation = useMutation({
    mutationFn: ({ code }) => verifyEmployerPhoneOtp(code),
    onSuccess: async () => {
      message.success('Số điện thoại đã được xác thực.')
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

  if (profileQuery.isLoading) {
    return (
      <>
        <VerificationBanner />
        <div className="p-5 sm:p-8">
          <Skeleton active paragraph={{ rows: 8 }} />
        </div>
      </>
    )
  }

  const profile = profileQuery.data || {}
  if (profile.onboarding?.phone_verified) {
    return (
      <>
        <VerificationBanner />
        <div className="p-5 sm:p-8">
          <Result
            status="success"
            icon={<CheckCircleFilled className="text-emerald-500" />}
            title="Số điện thoại đã được xác thực"
            subTitle={profile.verified_phone || profile.contact_phone}
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
            description={
              <span>
                Vui lòng{' '}
                <Link to={EMPLOYER_PASSWORD_SETTINGS_URL} className="font-bold">
                  cập nhật mật khẩu tại đây
                </Link>{' '}
                trước khi xác thực số điện thoại. Hỗ trợ: {hotline} · {supportEmail}.
              </span>
            }
          />
        </div>
      </>
    )
  }

  return (
    <>
      <VerificationBanner />
      <div className="p-5 sm:p-8">
        <h2 className="text-xl font-black text-slate-900">Cập nhật và xác thực số điện thoại</h2>

        <Form
          form={form}
          layout="vertical"
          className="mt-5"
          initialValues={{
            phone: profile.contact_phone || profile.verified_phone || user?.phone || '',
          }}
          onFinish={() => {
            if (otpSent) verifyMutation.mutate(form.getFieldsValue())
            else if (isAvailable && !isTaken && !isChecking) setPasswordOpen(true)
          }}
        >
          {!otpSent ? (
            <>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
                <Form.Item
                  name="phone"
                  className="mb-0 flex-1"
                  validateStatus={isTaken ? 'error' : undefined}
                  rules={[
                    { required: true, message: 'Nhập số điện thoại' },
                    { pattern: PHONE_PATTERN, message: 'Số điện thoại không hợp lệ' },
                  ]}
                >
                  <Input
                    size="large"
                    prefix={<PhoneOutlined className="text-slate-400" />}
                    suffix={isChecking ? <LoadingOutlined className="text-emerald-500" /> : null}
                    inputMode="tel"
                    placeholder="0912 345 678"
                    autoComplete="tel"
                  />
                </Form.Item>
                <Button
                  type="primary"
                  htmlType="submit"
                  size="large"
                  disabled={!isValidPhone || isChecking || isTaken || !isAvailable}
                  className="sm:w-40"
                >
                  Gửi mã xác thực
                </Button>
              </div>
              {isTaken && (
                <p className="mt-3 text-sm leading-6 text-red-500">
                  {availabilityQuery.data?.detail ||
                    'Đã có nhà tuyển dụng khác sử dụng & xác thực số điện thoại này, bạn vui lòng nhập số điện thoại khác và thực hiện lại thao tác.'}{' '}
                  Nếu bạn gặp khó khăn, vui lòng liên hệ với bộ phận Vận hành dịch vụ qua số Hotline{' '}
                  <b>{hotline}</b> hoặc gửi email tới địa chỉ {supportEmail}.
                </p>
              )}
            </>
          ) : (
            <>
              <p className="mb-4 text-sm leading-6 text-slate-500">
                Mã OTP gồm 6 chữ số đã được gửi tới email đăng nhập của bạn.
              </p>
              <Form.Item
                name="code"
                label="Mã OTP gồm 6 chữ số"
                rules={[{ required: true, len: 6, message: 'Nhập đủ 6 chữ số' }]}
              >
                <Input size="large" inputMode="numeric" maxLength={6} placeholder="000000" />
              </Form.Item>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button type="primary" htmlType="submit" size="large" loading={verifyMutation.isPending}>
                  Xác nhận mã OTP
                </Button>
                <Button size="large" onClick={() => setPasswordOpen(true)} loading={sendMutation.isPending}>
                  Gửi lại mã
                </Button>
                <Button type="link" onClick={() => setOtpSent(false)}>
                  Đổi số điện thoại
                </Button>
              </div>
            </>
          )}
        </Form>

        <div className="mt-8 border-t border-slate-100 pt-6">
          <p className="font-semibold text-slate-800">Lưu ý:</p>
          <ul className="mt-2 space-y-1.5 text-sm leading-6 text-slate-500">
            <li>
              Số điện thoại bạn cung cấp nên là số điện thoại bạn thường xuyên sử dụng và đã được đăng ký
              đầy đủ thông tin để tiện cho việc liên lạc sau này.
            </li>
            <li>
              Đường truyền không ổn định có thể sẽ khiến bạn không nhận được mã xác thực, hãy thử lại khi
              đường truyền ổn định.
            </li>
            <li>Nếu hệ thống vẫn chưa gửi mã OTP, hãy nhấn "Gửi lại" sau khi mã OTP cũ hết hiệu lực.</li>
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

      <Modal
        title="Nhập mật khẩu để xác thực"
        open={passwordOpen}
        onOk={submitPassword}
        onCancel={() => {
          setPasswordOpen(false)
          passwordForm.resetFields()
        }}
        okText="Xác nhận và gửi mã"
        cancelText="Hủy"
        confirmLoading={sendMutation.isPending}
        destroyOnClose
      >
        <p className="mb-4 text-sm leading-6 text-slate-500">
          Vì lý do bảo mật, vui lòng nhập mật khẩu đăng nhập của bạn để tiếp tục gửi mã xác thực tới số{' '}
          <b>{phoneValue}</b>.
        </p>
        <Form form={passwordForm} layout="vertical" onFinish={submitPassword}>
          <Form.Item
            name="password"
            label="Mật khẩu đăng nhập"
            rules={[{ required: true, message: 'Nhập mật khẩu đăng nhập' }]}
          >
            <Input.Password
              size="large"
              prefix={<LockOutlined className="text-slate-400" />}
              placeholder="Mật khẩu"
              autoComplete="current-password"
              autoFocus
            />
          </Form.Item>
        </Form>
      </Modal>
    </>
  )
}
