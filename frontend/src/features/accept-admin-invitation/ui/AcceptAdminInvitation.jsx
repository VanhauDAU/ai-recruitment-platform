import {
  CheckCircleFilled,
  LockOutlined,
  SafetyCertificateOutlined,
} from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import { Button, Form, Input, Result, Skeleton, Tag } from 'antd'
import { useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import {
  acceptAdminInvitation,
  adminAccountKeys,
  validateAdminInvitation,
} from '@/entities/admin-account'
import { getApiErrorMessage } from '@/shared/api/error-mapper'
import { adminPath } from '@/shared/config/portals'
import { message } from '@/shared/lib/toast'

export default function AcceptAdminInvitation() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token') || ''
  const [form] = Form.useForm()
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState(null)
  const query = useQuery({
    queryKey: [...adminAccountKeys.all, 'invitation-validation', token],
    queryFn: ({ signal }) => validateAdminInvitation(token, { signal }),
    enabled: Boolean(token) && !result,
    retry: false,
  })

  const submit = async () => {
    const values = await form.validateFields()
    setSubmitting(true)
    try {
      const response = await acceptAdminInvitation({ token, ...values })
      setResult(response)
      message.success('Tài khoản Admin đã được kích hoạt.')
    } catch (error) {
      message.error(getApiErrorMessage(error, 'Không thể kích hoạt tài khoản.'))
    } finally {
      setSubmitting(false)
    }
  }

  if (!token || query.isError) {
    return (
      <Result
        status="error"
        title="Liên kết mời không còn hiệu lực"
        subTitle={token
          ? getApiErrorMessage(query.error, 'Liên kết đã hết hạn, bị thu hồi hoặc đã được sử dụng.')
          : 'Liên kết đang thiếu token xác thực.'}
        extra={<Button href={adminPath('/login')}>Đến trang đăng nhập</Button>}
      />
    )
  }

  if (query.isLoading) {
    return <Skeleton active paragraph={{ rows: 6 }} />
  }

  if (result) {
    return (
      <div>
        <Result
          status="success"
          icon={<CheckCircleFilled className="text-emerald-600" />}
          title="Tài khoản Admin đã sẵn sàng"
          subTitle="Mật khẩu và chức danh đã được thiết lập. Bạn có thể bật xác thực hai yếu tố sau trong phần Bảo mật."
          extra={<Button type="primary" href={adminPath('/login')}>Đăng nhập Admin</Button>}
        />
      </div>
    )
  }

  const invitation = query.data
  return (
    <div>
      <div className="mb-6 text-center">
        <span className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--brand-primary-soft)] text-xl text-[var(--brand-primary)]">
          <SafetyCertificateOutlined />
        </span>
        <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--brand-primary)]">
          Admin invitation
        </p>
        <h1 className="text-2xl font-bold tracking-tight text-slate-950">
          Hoàn tất tài khoản quản trị
        </h1>
        <p className="mt-2 text-sm leading-6 text-slate-500">
          {`Xin chào ${invitation.full_name}, hãy thiết lập mật khẩu để tham gia hệ thống.`}
        </p>
      </div>

      <div className="mb-5 rounded-xl border border-slate-200 bg-slate-50 p-4">
        <div className="flex flex-wrap gap-2">
          <Tag color="blue">{invitation.target_role.department.name}</Tag>
          <Tag color="purple">{invitation.target_role.name}</Tag>
        </div>
        <p className="mb-0 mt-2 text-sm text-slate-600">{invitation.email}</p>
      </div>

      <Form form={form} layout="vertical" requiredMark={false} onFinish={submit}>
        <Form.Item
          name="password"
          label="Mật khẩu mới"
          rules={[
            { required: true, message: 'Nhập mật khẩu.' },
            { min: 8, message: 'Mật khẩu cần ít nhất 8 ký tự.' },
            {
              pattern: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/,
              message: 'Cần có chữ hoa, chữ thường và số.',
            },
          ]}
        >
          <Input.Password prefix={<LockOutlined />} maxLength={25} autoComplete="new-password" />
        </Form.Item>
        <Form.Item
          name="password_confirm"
          label="Xác nhận mật khẩu"
          dependencies={['password']}
          rules={[
            { required: true, message: 'Nhập lại mật khẩu.' },
            ({ getFieldValue }) => ({
              validator(_, value) {
                return !value || getFieldValue('password') === value
                  ? Promise.resolve()
                  : Promise.reject(new Error('Mật khẩu xác nhận không khớp.'))
              },
            }),
          ]}
        >
          <Input.Password prefix={<LockOutlined />} maxLength={25} autoComplete="new-password" />
        </Form.Item>
        <Button
          block
          type="primary"
          htmlType="submit"
          size="large"
          loading={submitting}
        >
          Kích hoạt tài khoản
        </Button>
      </Form>
      <p className="mt-5 text-center text-xs text-slate-500">
        Đã có tài khoản? <Link to={adminPath('/login')}>Đăng nhập Admin</Link>
      </p>
    </div>
  )
}
