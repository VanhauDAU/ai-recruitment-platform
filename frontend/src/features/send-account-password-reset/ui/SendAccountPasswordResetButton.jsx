import { KeyOutlined } from '@ant-design/icons'
import { Alert, Button, Form, Input, Modal, Typography } from 'antd'
import { useState } from 'react'
import { sendAdminAccountPasswordReset } from '@/entities/admin-account'
import { getApiErrorMessage } from '@/shared/api/error-mapper'
import { message } from '@/shared/lib/toast'

export default function SendAccountPasswordResetButton({
  accountEmail,
  disabled = false,
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
      await sendAdminAccountPasswordReset(publicId, {
        reason: values.reason.trim(),
      })
      message.success('Đã xếp lịch gửi email đặt lại mật khẩu.')
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
      <Button
        icon={<KeyOutlined />}
        disabled={disabled}
        onClick={() => setOpen(true)}
      >
        Gửi đặt lại mật khẩu
      </Button>
      <Modal
        open={open}
        title="Gửi liên kết đặt lại mật khẩu"
        okText="Xác nhận gửi"
        cancelText="Hủy"
        confirmLoading={sending}
        okButtonProps={{ danger: true }}
        onCancel={close}
        onOk={submit}
        destroyOnHidden
      >
        <div className="space-y-4">
          <Alert
            showIcon
            type="warning"
            title="Đây là thao tác bảo mật nhạy cảm"
            description={(
              <>
                Hệ thống sẽ gửi liên kết có thời hạn và chỉ dùng một lần
                {accountEmail ? (
                  <> đến <Typography.Text strong>{accountEmail}</Typography.Text></>
                ) : null}
                . Mật khẩu hiện tại chưa bị thay đổi ở bước này.
              </>
            )}
          />
          <Form form={form} layout="vertical" requiredMark={false}>
            <Form.Item
              name="reason"
              label="Lý do gửi liên kết"
              rules={[
                { required: true, whitespace: true, message: 'Nhập lý do gửi liên kết.' },
                { max: 500, message: 'Lý do không được vượt quá 500 ký tự.' },
              ]}
            >
              <Input.TextArea
                rows={3}
                maxLength={500}
                showCount
                placeholder="Ví dụ: Đã xác minh danh tính, admin không nhớ mật khẩu hiện tại"
              />
            </Form.Item>
          </Form>
        </div>
      </Modal>
    </>
  )
}
