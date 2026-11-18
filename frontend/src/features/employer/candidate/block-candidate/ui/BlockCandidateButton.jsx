import { StopOutlined } from '@ant-design/icons'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Button, Checkbox, Form, Input, Modal, Radio, Select } from 'antd'
import { useState } from 'react'
import { applicationKeys, blockCandidate, CANDIDATE_BLOCK_REASONS } from '@/entities/application/application'
import { getApiErrorMessage } from '@/shared/api/error-mapper'
import { message } from '@/shared/lib/toast'

const DURATIONS = [
  { value: 30, label: '30 ngày' },
  { value: 90, label: '90 ngày' },
  { value: 180, label: '180 ngày' },
  { value: 0, label: 'Cho tới khi tôi gỡ chặn' },
]

/** Stop a candidate from applying to any of this recruiter's jobs. */
export default function BlockCandidateButton({
  application,
  candidateName,
  size = 'small',
  type = 'default',
  block = false,
  label = 'Chặn ứng viên',
}) {
  const [open, setOpen] = useState(false)
  const queryClient = useQueryClient()
  const mutation = useMutation({
    mutationFn: (values) => blockCandidate({
      application_public_id: application.public_id,
      reason: values.reason,
      note: values.note || '',
      duration_days: values.duration_days || null,
      reject_pending: values.reject_pending,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: applicationKeys.all })
      setOpen(false)
      message.success(`Đã chặn ${candidateName}. Ứng viên không thể nộp thêm vào các tin của công ty.`)
    },
    onError: (error) => message.error(getApiErrorMessage(error, 'Không thể chặn ứng viên.')),
  })

  return (
    <>
      <Button size={size} type={type} danger block={block} icon={<StopOutlined />} aria-label="Chặn ứng viên" onClick={() => setOpen(true)}>
        {label}
      </Button>
      <Modal open={open} title={`Chặn ${candidateName}`} footer={null} destroyOnHidden onCancel={() => setOpen(false)}>
        <p className="text-xs leading-5 text-slate-500">
          Ứng viên sẽ không nộp được hồ sơ vào bất kỳ tin nào của bạn và chỉ thấy thông báo chung, không biết mình bị chặn.
        </p>
        <Form
          layout="vertical"
          requiredMark={false}
          className="!mt-3"
          initialValues={{ reason: 'spam', duration_days: 90, reject_pending: false }}
          onFinish={(values) => mutation.mutate(values)}
        >
          <Form.Item name="reason" label="Lý do">
            <Radio.Group className="!flex !flex-col !gap-1.5" options={CANDIDATE_BLOCK_REASONS} />
          </Form.Item>
          <Form.Item name="note" label="Ghi chú nội bộ (không bắt buộc)">
            <Input.TextArea rows={2} maxLength={1000} />
          </Form.Item>
          <Form.Item name="duration_days" label="Thời hạn">
            <Select options={DURATIONS} />
          </Form.Item>
          <Form.Item name="reject_pending" valuePropName="checked">
            <Checkbox>Chuyển các hồ sơ đang chờ của ứng viên ở mọi tin của công ty sang "Không phù hợp"</Checkbox>
          </Form.Item>
          <Button type="primary" danger htmlType="submit" block loading={mutation.isPending}>Chặn ứng viên</Button>
        </Form>
      </Modal>
    </>
  )
}
