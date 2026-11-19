import { StopOutlined } from '@ant-design/icons'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Button, Checkbox, Form, Input, Modal, Radio, Select } from 'antd'
import { useState } from 'react'
import { applicationKeys, blockCandidate, CANDIDATE_BLOCK_REASONS } from '@/entities/application/application'
import { getApiErrorMessage } from '@/shared/api/error-mapper'
import { message } from '@/shared/lib/toast'
import { m } from '@/shared/config/i18n'

const DURATIONS = [
  { value: 30, label: m.employer_workspace_days({ count: 30 }) },
  { value: 90, label: m.employer_workspace_days({ count: 90 }) },
  { value: 180, label: m.employer_workspace_days({ count: 180 }) },
  { value: 0, label: m.employer_workspace_block_until_unblocked() },
]

/** Stop a candidate from applying to any of this recruiter's jobs. */
export default function BlockCandidateButton({
  application,
  candidateName,
  size = 'small',
  type = 'default',
  block = false,
  label = m.employer_workspace_block_candidate(),
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
      message.success(m.employer_workspace_block_success({ name: candidateName }))
    },
    onError: (error) => message.error(getApiErrorMessage(error, m.employer_workspace_block_error())),
  })

  return (
    <>
      <Button size={size} type={type} danger block={block} icon={<StopOutlined />} aria-label={m.employer_workspace_block_candidate()} onClick={() => setOpen(true)}>
        {label}
      </Button>
      <Modal open={open} title={m.employer_workspace_block_title({ name: candidateName })} footer={null} destroyOnHidden onCancel={() => setOpen(false)}>
        <p className="text-xs leading-5 text-slate-500">
          {m.employer_workspace_block_intro()}
        </p>
        <Form
          layout="vertical"
          requiredMark={false}
          className="!mt-3"
          initialValues={{ reason: 'spam', duration_days: 90, reject_pending: false }}
          onFinish={(values) => mutation.mutate(values)}
        >
          <Form.Item name="reason" label={m.employer_workspace_block_reason()}>
            <Radio.Group className="!flex !flex-col !gap-1.5" options={CANDIDATE_BLOCK_REASONS} />
          </Form.Item>
          <Form.Item name="note" label={m.employer_workspace_block_note()}>
            <Input.TextArea rows={2} maxLength={1000} />
          </Form.Item>
          <Form.Item name="duration_days" label={m.employer_workspace_block_duration()}>
            <Select options={DURATIONS} />
          </Form.Item>
          <Form.Item name="reject_pending" valuePropName="checked">
            <Checkbox>{m.employer_workspace_block_reject_pending()}</Checkbox>
          </Form.Item>
          <Button type="primary" danger htmlType="submit" block loading={mutation.isPending}>{m.employer_workspace_block_candidate()}</Button>
        </Form>
      </Modal>
    </>
  )
}
