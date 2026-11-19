import { StarFilled, StarOutlined } from '@ant-design/icons'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Button, Form, Input, Modal, Select } from 'antd'
import { useState } from 'react'
import { addToTalentPool, applicationKeys } from '@/entities/application/application'
import { getApiErrorMessage } from '@/shared/api/error-mapper'
import { message } from '@/shared/lib/toast'
import { m } from '@/shared/config/i18n'

/** Keep a candidate for later openings; the candidate is told and may withdraw. */
export default function SaveToTalentPoolButton({ application, candidateName, block = false }) {
  const [open, setOpen] = useState(false)
  const queryClient = useQueryClient()
  const mutation = useMutation({
    mutationFn: (values) => addToTalentPool({ application_public_id: application.public_id, ...values }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: applicationKeys.all })
      setOpen(false)
      message.success(m.employer_workspace_pool_saved({ name: candidateName }))
    },
    onError: (error) => message.error(getApiErrorMessage(error, m.employer_workspace_pool_save_error())),
  })

  if (application.in_talent_pool) {
    return <Button size="small" block={block} icon={<StarFilled className="text-amber-500" />} disabled>{m.employer_workspace_pool_in_pool()}</Button>
  }
  return (
    <>
      <Button size="small" block={block} icon={<StarOutlined />} onClick={() => setOpen(true)}>{m.employer_workspace_pool_save()}</Button>
      <Modal open={open} title={m.employer_workspace_pool_save_title({ name: candidateName })} footer={null} destroyOnHidden onCancel={() => setOpen(false)}>
        <p className="text-xs leading-5 text-slate-500">
          {m.employer_workspace_pool_save_intro()}
        </p>
        <Form layout="vertical" requiredMark={false} className="!mt-3" onFinish={(values) => mutation.mutate(values)}>
          <Form.Item name="tags" label={m.employer_workspace_pool_tags()}>
            <Select mode="tags" maxCount={5} tokenSeparators={[',']} placeholder={m.employer_workspace_pool_tags_placeholder()} />
          </Form.Item>
          <Form.Item name="note" label={m.employer_workspace_app_internal_note()}>
            <Input.TextArea rows={3} maxLength={2000} placeholder={m.employer_workspace_pool_note_placeholder()} />
          </Form.Item>
          <Button type="primary" htmlType="submit" block loading={mutation.isPending}>{m.employer_workspace_pool_save()}</Button>
        </Form>
      </Modal>
    </>
  )
}
