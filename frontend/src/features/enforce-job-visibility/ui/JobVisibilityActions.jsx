import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Button, Form, Input, Modal, Select, Space } from 'antd'
import { useState } from 'react'
import {
  adminJobKeys,
  decideAdminJob,
  JOB_DECISION_REASONS,
} from '@/entities/admin-job'
import { useAdminAccess } from '@/entities/admin-access'
import { useSession } from '@/entities/session'
import { getApiErrorMessage } from '@/shared/api/error-mapper'
import { message } from '@/shared/lib/toast'

const HOLD_OPTIONS = [
  { value: 'manual_review', label: 'Tạm giữ để kiểm tra thêm' },
  { value: 'confirmed_violation', label: 'Vi phạm đã xác nhận' },
]

export default function JobVisibilityActions({ job }) {
  const { user } = useSession()
  const access = useAdminAccess(user)
  const queryClient = useQueryClient()
  const [action, setAction] = useState('')
  const [form] = Form.useForm()
  const canEnforce = access.has('job_moderation.enforce_visibility')
  const canHide = canEnforce && job.state_actions?.includes('hide')
  const canRestore = canEnforce && job.state_actions?.includes('restore')

  const mutation = useMutation({
    mutationFn: (payload) => decideAdminJob(job.public_id, {
      ...payload,
      review_token: job.review_token,
    }),
    onSuccess: (updated, payload) => {
      queryClient.setQueryData(adminJobKeys.detail(job.public_id), updated)
      queryClient.invalidateQueries({ queryKey: adminJobKeys.lists() })
      queryClient.invalidateQueries({ queryKey: adminJobKeys.summary })
      message.success(
        payload.action === 'hide'
          ? 'Đã tạm ẩn tin khỏi các bề mặt công khai.'
          : 'Đã khôi phục hiển thị tin tuyển dụng.',
      )
      form.resetFields()
      setAction('')
    },
    onError: (error) => {
      if (error?.response?.status === 409) {
        queryClient.invalidateQueries({ queryKey: adminJobKeys.detail(job.public_id) })
      }
      message.error(getApiErrorMessage(error, 'Không thể cập nhật phạm vi hiển thị tin.'))
    },
  })

  async function submit() {
    let values
    try {
      values = await form.validateFields()
    } catch {
      return
    }
    mutation.mutate({
      action,
      ...(action === 'hide' && {
        hold: values.hold,
        reason_code: values.reason_code,
      }),
      note: values.note.trim(),
    })
  }

  if (!canHide && !canRestore) return null

  return (
    <>
      <Space wrap>
        {canHide && <Button danger onClick={() => setAction('hide')}>Tạm ẩn tin</Button>}
        {canRestore && <Button onClick={() => setAction('restore')}>Khôi phục hiển thị</Button>}
      </Space>
      <Modal
        cancelText="Hủy"
        confirmLoading={mutation.isPending}
        destroyOnHidden
        okButtonProps={{ danger: action === 'hide' }}
        okText={action === 'hide' ? 'Tạm ẩn tin' : 'Khôi phục hiển thị'}
        onCancel={() => {
          if (mutation.isPending) return
          form.resetFields()
          setAction('')
        }}
        onOk={submit}
        open={Boolean(action)}
        title={action === 'hide' ? 'Tạm ẩn tin tuyển dụng' : 'Khôi phục hiển thị tin'}
      >
        <Form
          form={form}
          initialValues={{ hold: 'manual_review' }}
          layout="vertical"
          preserve={false}
        >
          {action === 'hide' && (
            <>
              <Form.Item label="Mức tạm giữ" name="hold" rules={[{ required: true }]}> 
                <Select options={HOLD_OPTIONS} />
              </Form.Item>
              <Form.Item
                label="Căn cứ xử lý"
                name="reason_code"
                rules={[{ required: true, message: 'Chọn căn cứ xử lý.' }]}
              >
                <Select options={JOB_DECISION_REASONS} placeholder="Chọn căn cứ" />
              </Form.Item>
            </>
          )}
          <Form.Item
            label={action === 'hide' ? 'Ghi chú tạm ẩn' : 'Lý do khôi phục'}
            name="note"
            rules={[{ required: true, whitespace: true, message: 'Nhập ghi chú xử lý.' }]}
          >
            <Input.TextArea maxLength={3000} rows={4} showCount />
          </Form.Item>
        </Form>
      </Modal>
    </>
  )
}
