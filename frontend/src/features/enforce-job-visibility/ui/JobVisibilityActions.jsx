import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Button, Form, Input, Modal, Select, Space } from 'antd'
import { useState } from 'react'
import {
  adminJobKeys,
  decideAdminJob,
  JOB_DECISION_REASONS,
  JOB_FIXABLE_REASONS,
} from '@/entities/admin-job'
import { getApiErrorMessage } from '@/shared/api/error-mapper'
import { message } from '@/shared/lib/toast'

const ACTION_COPY = {
  hide: { button: 'Tạm ẩn tin', title: 'Tạm ẩn tin tuyển dụng', note: 'Ghi chú tạm ẩn', done: 'Đã tạm ẩn tin khỏi các bề mặt công khai.' },
  request_changes: {
    button: 'Yêu cầu chỉnh sửa',
    title: 'Yêu cầu nhà tuyển dụng chỉnh sửa tin',
    note: 'Nội dung cần chỉnh sửa (gửi cho nhà tuyển dụng)',
    done: 'Đã tạm ẩn tin và gửi yêu cầu chỉnh sửa cho nhà tuyển dụng.',
  },
  restore: { button: 'Khôi phục hiển thị', title: 'Khôi phục hiển thị tin', note: 'Lý do khôi phục', done: 'Đã khôi phục hiển thị tin tuyển dụng.' },
}

const HOLD_OPTIONS = [
  { value: 'manual_review', label: 'Tạm giữ để kiểm tra thêm' },
  { value: 'confirmed_violation', label: 'Vi phạm đã xác nhận' },
]

export default function JobVisibilityActions({ job }) {
  const queryClient = useQueryClient()
  const [action, setAction] = useState('')
  const [form] = Form.useForm()
  const available = ['hide', 'request_changes', 'restore'].filter((key) => job.state_actions?.includes(key))
  const copy = ACTION_COPY[action] || ACTION_COPY.restore

  const mutation = useMutation({
    mutationFn: (payload) => decideAdminJob(job.public_id, {
      ...payload,
      review_token: job.review_token,
    }),
    onSuccess: (updated, payload) => {
      queryClient.setQueryData(adminJobKeys.detail(job.public_id), updated)
      queryClient.invalidateQueries({ queryKey: adminJobKeys.lists() })
      queryClient.invalidateQueries({ queryKey: adminJobKeys.summary })
      message.success(ACTION_COPY[payload.action].done)
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
      ...(action === 'hide' && { hold: values.hold }),
      ...(action !== 'restore' && { reason_code: values.reason_code }),
      note: values.note.trim(),
    })
  }

  if (!available.length) return null

  return (
    <>
      <Space wrap>
        {available.map((key) => (
          <Button key={key} danger={key === 'hide'} onClick={() => setAction(key)}>{ACTION_COPY[key].button}</Button>
        ))}
      </Space>
      <Modal
        cancelText="Hủy"
        confirmLoading={mutation.isPending}
        destroyOnHidden
        okButtonProps={{ danger: action === 'hide' }}
        okText={copy.button}
        onCancel={() => {
          if (mutation.isPending) return
          form.resetFields()
          setAction('')
        }}
        onOk={submit}
        open={Boolean(action)}
        title={copy.title}
      >
        <Form
          form={form}
          initialValues={{ hold: 'manual_review' }}
          layout="vertical"
          preserve={false}
        >
          {action === 'hide' && (
            <Form.Item label="Mức tạm giữ" name="hold" rules={[{ required: true }]}>
              <Select options={HOLD_OPTIONS} />
            </Form.Item>
          )}
          {action !== 'restore' && (
            <Form.Item
              label="Căn cứ xử lý"
              name="reason_code"
              rules={[{ required: true, message: 'Chọn căn cứ xử lý.' }]}
            >
              <Select
                options={action === 'request_changes' ? JOB_FIXABLE_REASONS : JOB_DECISION_REASONS}
                placeholder="Chọn căn cứ"
              />
            </Form.Item>
          )}
          <Form.Item
            label={copy.note}
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
