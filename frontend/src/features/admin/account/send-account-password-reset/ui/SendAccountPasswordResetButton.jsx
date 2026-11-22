import { KeyOutlined } from '@ant-design/icons'
import { Button, Form, Tooltip } from 'antd'
import { useState } from 'react'
import {
  AccountVerificationSummary,
  sendAdminAccountPasswordReset,
} from '@/entities/account/admin-account'
import { getApiErrorMessage } from '@/shared/api/error-mapper'
import { message } from '@/shared/lib/toast'
import ActionDialog from '@/shared/ui/confirm-action/ActionDialog'
import ReasonField from '@/shared/ui/confirm-action/ReasonField'

const RESET_REASONS = [
  'Người dùng quên mật khẩu, đã xác minh qua email công ty',
  'Người dùng quên mật khẩu, đã xác minh qua số điện thoại',
]

export default function SendAccountPasswordResetButton({
  account,
  accountEmail,
  disabled = false,
  disabledReason = '',
  label = 'Gửi đặt lại mật khẩu',
  onSuccess,
  publicId,
  type = 'default',
}) {
  const [form] = Form.useForm()
  const [open, setOpen] = useState(false)
  const [sending, setSending] = useState(false)

  function close() {
    if (sending) return
    setOpen(false)
    form.resetFields()
  }

  async function submit() {
    let values
    try {
      values = await form.validateFields()
    } catch {
      return
    }
    setSending(true)
    try {
      const result = await sendAdminAccountPasswordReset(publicId, {
        reason: values.reason.trim(),
      })
      message.success('Đã xếp lịch gửi email đặt lại mật khẩu.')
      onSuccess?.(result)
      setOpen(false)
      form.resetFields()
    } catch (error) {
      message.error(getApiErrorMessage(
        error,
        'Không thể gửi liên kết đặt lại mật khẩu.',
      ))
    } finally {
      setSending(false)
    }
  }

  return (
    <>
      <Tooltip title={disabled ? disabledReason : 'Gửi link để người dùng tự đặt mật khẩu mới'}>
        <span>
          <Button
            icon={type === 'primary' ? <KeyOutlined /> : null}
            disabled={disabled}
            type={type}
            onClick={() => setOpen(true)}
          >
            {label}
          </Button>
        </span>
      </Tooltip>
      <ActionDialog
        loading={sending}
        onCancel={close}
        onSubmit={submit}
        open={open}
        submitLabel="Gửi email đặt lại"
        target={account?.email || accountEmail}
        title="Gửi liên kết đặt lại mật khẩu"
        width={640}
      >
        <AccountVerificationSummary account={account} />
        <p className="action-dialog__lead">
          Liên kết có thời hạn và chỉ dùng một lần. Mật khẩu hiện tại chưa bị thay đổi ở bước này.
        </p>
        <Form form={form} layout="vertical" requiredMark initialValues={{ reason: '' }}>
          <ReasonField
            extra="Ghi kênh xác minh và thông tin đã đối chiếu với hồ sơ."
            label="Lý do gửi liên kết"
            presets={RESET_REASONS}
          />
        </Form>
      </ActionDialog>
    </>
  )
}
