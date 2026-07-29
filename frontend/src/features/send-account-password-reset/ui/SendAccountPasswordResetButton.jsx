import { KeyOutlined } from '@ant-design/icons'
import { Alert, Button, Form, Input, Modal, Tooltip, Typography } from 'antd'
import { useState } from 'react'
import {
  AccountVerificationSummary,
  sendAdminAccountPasswordReset,
} from '@/entities/admin-account'
import { getApiErrorMessage } from '@/shared/api/error-mapper'
import { message } from '@/shared/lib/toast'

export default function SendAccountPasswordResetButton({
  account,
  accountEmail,
  disabled = false,
  disabledReason = '',
  onSuccess,
  publicId,
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
            icon={<KeyOutlined />}
            disabled={disabled}
            onClick={() => setOpen(true)}
          >
            Gửi đặt lại mật khẩu
          </Button>
        </span>
      </Tooltip>
      <Modal
        open={open}
        width={720}
        title="Gửi liên kết đặt lại mật khẩu"
        okText="Xác nhận gửi"
        cancelText="Hủy"
        confirmLoading={sending}
        okButtonProps={{ danger: true }}
        styles={{
          body: {
            maxHeight: 'calc(100vh - 220px)',
            overflowY: 'auto',
            paddingRight: 4,
          },
        }}
        onCancel={close}
        onOk={submit}
        destroyOnHidden
      >
        <div className="space-y-4">
          <AccountVerificationSummary account={account} />
          <Alert
            showIcon
            type="warning"
            title="Đây là thao tác bảo mật nhạy cảm"
            description={(
              <>
                Hệ thống sẽ gửi liên kết có thời hạn và chỉ dùng một lần
                {account?.email || accountEmail ? (
                  <> đến <Typography.Text strong>{account?.email || accountEmail}</Typography.Text></>
                ) : null}
                . Mật khẩu hiện tại chưa bị thay đổi ở bước này.
              </>
            )}
          />
          <Form form={form} layout="vertical" requiredMark>
            <Form.Item
              name="reason"
              label="Lý do gửi liên kết"
              rules={[
                { required: true, whitespace: true, message: 'Nhập lý do gửi liên kết.' },
                { max: 500, message: 'Lý do không được vượt quá 500 ký tự.' },
              ]}
            >
              <Input.TextArea
                autoFocus
                size="large"
                rows={4}
                maxLength={500}
                showCount
                placeholder="Ghi rõ kênh xác minh và các thông tin đã đối chiếu với hồ sơ phía trên."
              />
            </Form.Item>
          </Form>
        </div>
      </Modal>
    </>
  )
}
