import { CheckCircleFilled, PhoneOutlined, SafetyCertificateOutlined } from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Alert, App, Button, Form, Input, Result, Skeleton } from 'antd'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  getEmployerProfile,
  sendEmployerPhoneOtp,
  verifyEmployerPhoneOtp,
} from '@/entities/employer-profile'
import { useSession } from '@/entities/session'
import { settingText, useSiteSettings } from '@/entities/site-settings'
import { getApiErrorMessage } from '@/shared/api/error-mapper'
import { EMPLOYER_PASSWORD_SETTINGS_URL } from '@/shared/config/portals'

export default function EmployerPhoneVerification() {
  const { user, refreshSession } = useSession()
  const { settings } = useSiteSettings()
  const { message } = App.useApp()
  const queryClient = useQueryClient()
  const [form] = Form.useForm()
  const [otpSent, setOtpSent] = useState(false)
  const profileQuery = useQuery({ queryKey: ['employer', 'profile'], queryFn: getEmployerProfile })
  const hotline = settingText(settings.hotline, '1900 1234')
  const supportEmail = settingText(settings.support_email, 'cskh@procv.vn')
  const sendMutation = useMutation({
    mutationFn: ({ phone }) => sendEmployerPhoneOtp(phone),
    onSuccess: () => {
      setOtpSent(true)
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

  if (profileQuery.isLoading) return <Skeleton active paragraph={{ rows: 9 }} />
  const profile = profileQuery.data || {}
  if (profile.onboarding?.phone_verified) {
    return <Result status="success" icon={<CheckCircleFilled className="text-emerald-500" />} title="Số điện thoại đã được xác thực" subTitle={profile.verified_phone || profile.contact_phone} />
  }
  if (!user?.has_usable_password) {
    return (
      <Alert
        type="warning"
        showIcon
        title="Tài khoản chưa có mật khẩu đăng nhập"
        description={<span>Vui lòng <Link to={EMPLOYER_PASSWORD_SETTINGS_URL} className="font-bold">cập nhật mật khẩu tại đây</Link> trước khi xác thực số điện thoại. Hỗ trợ: {hotline} · {supportEmail}.</span>}
      />
    )
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_300px]">
      <div>
        <h2 className="text-xl font-black text-slate-900">Cập nhật và xác thực số điện thoại</h2>
        <p className="mt-2 text-sm leading-6 text-slate-500">Mã OTP được gửi tới email đăng nhập để xác nhận bạn đang kiểm soát tài khoản này.</p>
        <Form
          form={form}
          layout="vertical"
          className="mt-6"
          initialValues={{ phone: profile.contact_phone || profile.verified_phone || user?.phone || '' }}
          onFinish={(values) => otpSent ? verifyMutation.mutate(values) : sendMutation.mutate(values)}
        >
          {!otpSent ? (
            <Form.Item name="phone" label="Số điện thoại" rules={[{ required: true, message: 'Nhập số điện thoại' }, { pattern: /^(0|\+84)\d{9,10}$/, message: 'Số điện thoại không hợp lệ' }]}>
              <Input size="large" prefix={<PhoneOutlined />} inputMode="tel" placeholder="0912 345 678" />
            </Form.Item>
          ) : (
            <Form.Item name="code" label="Mã OTP gồm 6 chữ số" rules={[{ required: true, len: 6, message: 'Nhập đủ 6 chữ số' }]}>
              <Input size="large" inputMode="numeric" maxLength={6} placeholder="000000" />
            </Form.Item>
          )}
          <Button type="primary" htmlType="submit" size="large" block loading={sendMutation.isPending || verifyMutation.isPending}>
            {otpSent ? 'Xác nhận mã OTP' : 'Gửi mã xác thực'}
          </Button>
          {otpSent && <Button type="link" block onClick={() => setOtpSent(false)} className="!mt-2">Đổi số điện thoại</Button>}
        </Form>
      </div>
      <aside className="rounded-2xl bg-emerald-50 p-5">
        <SafetyCertificateOutlined className="text-3xl text-emerald-600" />
        <h3 className="mt-4 font-extrabold text-slate-900">Lợi ích khi xác thực</h3>
        <ul className="mt-3 space-y-3 text-sm leading-6 text-slate-600">
          <li>Tăng cường bảo mật và chống giả mạo tài khoản.</li>
          <li>Nâng cao độ tin cậy của thương hiệu tuyển dụng.</li>
          <li>Nhận hỗ trợ nhanh hơn khi có vấn đề phát sinh.</li>
        </ul>
      </aside>
    </div>
  )
}
