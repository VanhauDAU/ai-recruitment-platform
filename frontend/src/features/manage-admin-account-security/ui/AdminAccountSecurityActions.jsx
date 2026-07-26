import { LockOutlined, ReloadOutlined, StopOutlined } from '@ant-design/icons'
import { useQueryClient } from '@tanstack/react-query'
import { Alert, Button, Descriptions, Form, Input, Modal, Select, Space, Tag } from 'antd'
import { useState } from 'react'
import {
  adminAccountKeys,
  changeAccountStatus,
  getAccountSessionsImpact,
  getAccountStatusImpact,
  revokeAccountSessions,
} from '@/entities/admin-account'
import { getApiErrorMessage } from '@/shared/api/error-mapper'
import { message } from '@/shared/lib/toast'

const STATUS = {
  active: { label: 'Đang hoạt động', color: 'green' },
  inactive: { label: 'Tạm khóa', color: 'orange' },
  banned: { label: 'Đã cấm', color: 'red' },
}

function StatusTag({ status }) {
  const meta = STATUS[status] || { label: status, color: 'default' }
  return <Tag color={meta.color}>{meta.label}</Tag>
}

export default function AdminAccountSecurityActions({ account, allowStatus = true }) {
  const queryClient = useQueryClient()
  const [form] = Form.useForm()
  const [operation, setOperation] = useState(null)
  const [loading, setLoading] = useState(false)

  const close = () => {
    setOperation(null)
    form.resetFields()
  }
  const preview = async () => {
    const values = await form.validateFields()
    setLoading(true)
    try {
      const result = operation.kind === 'status'
        ? await getAccountStatusImpact(account.public_id, values)
        : await getAccountSessionsImpact(account.public_id, values.reason)
      setOperation((current) => ({ ...current, ...values, preview: result }))
    } catch (error) {
      message.error(getApiErrorMessage(error, 'Không thể xem tác động.'))
    } finally {
      setLoading(false)
    }
  }
  const confirm = async () => {
    setLoading(true)
    try {
      if (operation.kind === 'status') {
        await changeAccountStatus(
          account.public_id,
          { status: operation.status, reason: operation.reason },
          operation.preview.impact_token,
        )
        message.success('Đã cập nhật trạng thái tài khoản.')
      } else {
        await revokeAccountSessions(
          account.public_id,
          operation.reason,
          operation.preview.impact_token,
        )
        message.success('Đã thu hồi toàn bộ phiên đăng nhập.')
      }
      close()
      await queryClient.invalidateQueries({ queryKey: adminAccountKeys.all })
    } catch (error) {
      if (error?.response?.status === 409) {
        message.warning('Dữ liệu đã thay đổi. Vui lòng xem lại tác động.')
        setOperation((current) => ({ ...current, preview: null }))
      } else {
        message.error(getApiErrorMessage(error))
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <Space wrap>
        {allowStatus && (
          <Button
            danger={account.status === 'active'}
            icon={account.status === 'active' ? <LockOutlined /> : <ReloadOutlined />}
            onClick={() => setOperation({ kind: 'status' })}
          >
            Đổi trạng thái
          </Button>
        )}
        <Button
          danger
          icon={<StopOutlined />}
          onClick={() => setOperation({ kind: 'sessions' })}
        >
          Thu hồi mọi phiên
        </Button>
      </Space>
      <Modal
        open={Boolean(operation)}
        title={operation?.kind === 'status'
          ? 'Thay đổi trạng thái tài khoản'
          : 'Thu hồi toàn bộ phiên đăng nhập'}
        okText={operation?.preview ? 'Xác nhận thực hiện' : 'Xem tác động'}
        cancelText="Hủy"
        confirmLoading={loading}
        okButtonProps={{
          danger: operation?.kind === 'sessions' || operation?.status !== 'active',
        }}
        onCancel={close}
        onOk={operation?.preview ? confirm : preview}
        destroyOnHidden
      >
        {operation?.preview ? (
          <div className="space-y-4">
            <Alert
              showIcon
              type="warning"
              title="Kiểm tra tác động trước khi xác nhận"
              description={operation.reason}
            />
            <Descriptions bordered size="small" column={1}>
              {operation.kind === 'status' && (
                <>
                  <Descriptions.Item label="Hiện tại">
                    <StatusTag status={account.status} />
                  </Descriptions.Item>
                  <Descriptions.Item label="Sau thay đổi">
                    <StatusTag status={operation.status} />
                  </Descriptions.Item>
                </>
              )}
              <Descriptions.Item label="Phiên bị thu hồi">
                {operation.preview.active_session_count}
              </Descriptions.Item>
            </Descriptions>
          </div>
        ) : (
          <Form
            form={form}
            layout="vertical"
            requiredMark={false}
            initialValues={{
              status: account.status === 'active' ? 'inactive' : 'active',
              reason: '',
            }}
            scrollToFirstError={{ focus: true }}
          >
            {operation?.kind === 'status' && (
              <Form.Item name="status" label="Trạng thái mới" rules={[{ required: true }]}>
                <Select options={[
                  { value: 'active', label: 'Đang hoạt động' },
                  { value: 'inactive', label: 'Tạm khóa' },
                  { value: 'banned', label: 'Cấm tài khoản' },
                ]}
                />
              </Form.Item>
            )}
            <Form.Item
              name="reason"
              label="Lý do"
              rules={[
                { required: true, message: 'Nhập lý do thao tác.' },
                { max: 500, message: 'Tối đa 500 ký tự.' },
              ]}
            >
              <Input.TextArea rows={3} maxLength={500} showCount />
            </Form.Item>
          </Form>
        )}
      </Modal>
    </>
  )
}
