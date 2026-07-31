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

export default function JobSubmissionReviewActions({ job }) {
  const { user } = useSession()
  const access = useAdminAccess(user)
  const queryClient = useQueryClient()
  const [decision, setDecision] = useState('')
  const [form] = Form.useForm()
  const canApprove = access.has('job_moderation.approve')
    && job.state_actions?.includes('approve')
  const canReject = access.has('job_moderation.reject')
    && job.state_actions?.includes('reject')

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
        payload.action === 'approve'
          ? 'Đã duyệt và công khai tin tuyển dụng.'
          : 'Đã lưu quyết định từ chối; lý do sẽ hiển thị cho nhà tuyển dụng.',
      )
      if (payload.action === 'reject') form.resetFields()
      setDecision('')
    },
    onError: (error) => {
      if (error?.response?.status === 409) {
        queryClient.invalidateQueries({ queryKey: adminJobKeys.detail(job.public_id) })
      }
      message.error(getApiErrorMessage(error, 'Không thể ghi nhận quyết định kiểm duyệt.'))
    },
  })

  async function submitReject() {
    let values
    try {
      values = await form.validateFields()
    } catch {
      return
    }
    mutation.mutate({
      action: 'reject',
      reason_code: values.reason_code,
      note: values.note.trim(),
    })
  }

  if (!canApprove && !canReject) return null

  return (
    <>
      <Space wrap>
        {canApprove && (
          <Button type="primary" onClick={() => setDecision('approve')}>
            Duyệt tin
          </Button>
        )}
        {canReject && (
          <Button danger onClick={() => setDecision('reject')}>
            Từ chối
          </Button>
        )}
      </Space>

      <Modal
        cancelText="Hủy"
        confirmLoading={mutation.isPending}
        okText="Duyệt và công khai"
        onCancel={() => setDecision('')}
        onOk={() => mutation.mutate({ action: 'approve' })}
        open={decision === 'approve'}
        title="Duyệt tin tuyển dụng"
      >
        <p className="text-sm leading-6 text-slate-600">
          Xác nhận bạn đã kiểm tra nội dung, điều kiện tuyển dụng và tín hiệu tin cậy
          của nhà tuyển dụng. Tin sẽ hiển thị công khai ngay sau khi duyệt.
        </p>
      </Modal>

      <Modal
        cancelText="Hủy"
        confirmLoading={mutation.isPending}
        destroyOnHidden
        okButtonProps={{ danger: true }}
        okText="Lưu quyết định từ chối"
        onCancel={() => {
          if (mutation.isPending) return
          form.resetFields()
          setDecision('')
        }}
        onOk={submitReject}
        open={decision === 'reject'}
        title="Từ chối tin tuyển dụng"
      >
        <Form form={form} layout="vertical" preserve={false}>
          <Form.Item
            label="Nhóm lý do"
            name="reason_code"
            rules={[{ required: true, message: 'Chọn nhóm lý do từ chối.' }]}
          >
            <Select options={JOB_DECISION_REASONS} placeholder="Chọn lý do" />
          </Form.Item>
          <Form.Item
            label="Hướng dẫn chỉnh sửa cho nhà tuyển dụng"
            name="note"
            rules={[{ required: true, whitespace: true, message: 'Nhập lý do từ chối.' }]}
          >
            <Input.TextArea
              maxLength={3000}
              placeholder="Nêu rõ nội dung cần bổ sung hoặc điều chỉnh."
              rows={5}
              showCount
            />
          </Form.Item>
        </Form>
      </Modal>
    </>
  )
}
