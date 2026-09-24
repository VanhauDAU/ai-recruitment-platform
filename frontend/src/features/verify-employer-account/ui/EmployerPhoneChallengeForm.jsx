import {
  LoadingOutlined,
  LockOutlined,
  PhoneOutlined,
} from '@ant-design/icons'
import { Alert, Button, Form, Input, Modal } from 'antd'
import { isVietnameseMobile } from '../model/vietnamese-mobile'

const ACTIVE_DISPATCH_STATES = new Set(['queued', 'dispatching', 'retry_pending'])

function ChallengeStatus({ challenge, error }) {
  if (error) {
    return (
      <Alert
        type="error"
        showIcon
        message="Không thể cập nhật trạng thái SMS"
        description="Vui lòng thử gửi lại mã. Yêu cầu cũ không được dùng để xác thực."
      />
    )
  }
  if (!challenge) return null
  if (ACTIVE_DISPATCH_STATES.has(challenge.status)) {
    return (
      <Alert
        type="info"
        showIcon
        icon={<LoadingOutlined spin />}
        message="Đang gửi mã qua SMS"
        description="Ô nhập mã sẽ mở khi tin nhắn được gửi thành công."
      />
    )
  }
  if (challenge.status === 'sent') {
    return (
      <Alert
        type="success"
        showIcon
        message="Mã SMS đã được gửi"
        description="Mỗi mã chỉ dùng một lần và gắn với đúng yêu cầu này."
      />
    )
  }
  if (challenge.status === 'verified') {
    return <Alert type="success" showIcon message="Yêu cầu này đã được xác thực." />
  }
  return (
    <Alert
      type="error"
      showIcon
      message="Không thể sử dụng mã SMS này"
      description="Mã đã hết hạn hoặc quá trình gửi thất bại. Vui lòng gửi mã mới."
    />
  )
}

export default function EmployerPhoneChallengeForm({
  form,
  passwordForm,
  flowMode,
  initialPhone,
  phoneValue,
  validPhone,
  challenge,
  challengeError,
  canVerify,
  passwordOpen,
  sendPending,
  verifyPending,
  onOpenPassword,
  onClosePassword,
  onSubmitPassword,
  onVerify,
  onClearChallenge,
}) {
  const otpSent = Boolean(challenge?.public_id)
  return (
    <>
      <Form
        form={form}
        layout="vertical"
        className="mt-5"
        initialValues={{ phone: initialPhone }}
        onFinish={() => {
          if (otpSent && canVerify) onVerify(form.getFieldsValue())
          else if (!otpSent && validPhone) onOpenPassword()
        }}
      >
        {!otpSent ? (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
            <Form.Item
              name="phone"
              className="mb-0 flex-1"
              rules={[
                { required: true, message: 'Nhập số điện thoại' },
                {
                  validator: (_, value) => (
                    isVietnameseMobile(value)
                      ? Promise.resolve()
                      : Promise.reject(new Error('Nhập số di động Việt Nam hợp lệ'))
                  ),
                },
              ]}
            >
              <Input
                size="large"
                prefix={<PhoneOutlined className="text-slate-400" />}
                inputMode="tel"
                placeholder="0912 345 678"
                autoComplete="tel"
                disabled={flowMode === 'reverify'}
              />
            </Form.Item>
            <Button
              type="primary"
              htmlType="submit"
              size="large"
              disabled={!validPhone}
              className="sm:w-40"
            >
              Gửi mã SMS
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <ChallengeStatus challenge={challenge} error={challengeError} />
            <Form.Item
              name="code"
              label="Mã SMS gồm 6 chữ số"
              rules={[
                { required: true, message: 'Nhập mã xác thực' },
                { pattern: /^\d{6}$/, message: 'Nhập đủ 6 chữ số' },
              ]}
            >
              <Input
                size="large"
                inputMode="numeric"
                maxLength={6}
                placeholder="000000"
                disabled={!canVerify}
              />
            </Form.Item>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button
                type="primary"
                htmlType="submit"
                size="large"
                disabled={!canVerify}
                loading={verifyPending}
              >
                Xác nhận mã SMS
              </Button>
              <Button size="large" onClick={onOpenPassword} loading={sendPending}>
                Gửi mã mới
              </Button>
              {flowMode !== 'reverify' && (
                <Button type="link" onClick={onClearChallenge}>
                  Đổi số điện thoại
                </Button>
              )}
            </div>
          </div>
        )}
      </Form>

      <Modal
        title="Xác nhận mật khẩu"
        open={passwordOpen}
        onOk={onSubmitPassword}
        onCancel={onClosePassword}
        okText="Xác nhận và gửi SMS"
        cancelText="Hủy"
        confirmLoading={sendPending}
        destroyOnHidden
      >
        <p className="mb-4 text-sm leading-6 text-slate-500">
          Nhập mật khẩu hiện tại để gửi mã tới số <b>{phoneValue}</b>.
          Số đã xác thực trước đó chỉ thay đổi sau khi mã mới hợp lệ.
        </p>
        <Form form={passwordForm} layout="vertical" onFinish={onSubmitPassword}>
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
