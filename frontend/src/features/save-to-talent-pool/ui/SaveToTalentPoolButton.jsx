import { StarFilled, StarOutlined } from '@ant-design/icons'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Button, Form, Input, Modal, Select } from 'antd'
import { useState } from 'react'
import { addToTalentPool, applicationKeys } from '@/entities/application'
import { getApiErrorMessage } from '@/shared/api/error-mapper'
import { message } from '@/shared/lib/toast'

/** Keep a candidate for later openings; the candidate is told and may withdraw. */
export default function SaveToTalentPoolButton({ application, candidateName }) {
  const [open, setOpen] = useState(false)
  const queryClient = useQueryClient()
  const mutation = useMutation({
    mutationFn: (values) => addToTalentPool({ application_public_id: application.public_id, ...values }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: applicationKeys.all })
      setOpen(false)
      message.success(`Đã lưu ${candidateName} vào kho ứng viên tiềm năng.`)
    },
    onError: (error) => message.error(getApiErrorMessage(error, 'Không thể lưu vào kho.')),
  })

  if (application.in_talent_pool) {
    return <Button size="small" type="text" icon={<StarFilled className="text-amber-500" />} disabled>Đã trong kho tiềm năng</Button>
  }
  return (
    <>
      <Button size="small" type="text" icon={<StarOutlined />} onClick={() => setOpen(true)}>Lưu vào kho tiềm năng</Button>
      <Modal open={open} title={`Lưu ${candidateName} vào kho tiềm năng`} footer={null} destroyOnHidden onCancel={() => setOpen(false)}>
        <p className="text-xs leading-5 text-slate-500">
          Dùng khi hồ sơ chưa hợp vị trí này nhưng có tiềm năng. Khi bạn đăng tin mới, hệ thống gợi ý lại người trong kho.
          Ứng viên được thông báo và có thể rút hồ sơ; mục tự hết hạn sau 12 tháng.
        </p>
        <Form layout="vertical" requiredMark={false} className="!mt-3" onFinish={(values) => mutation.mutate(values)}>
          <Form.Item name="tags" label="Nhãn (tối đa 5)">
            <Select mode="tags" maxCount={5} tokenSeparators={[',']} placeholder="Ví dụ: Python, Tiếng Anh tốt" />
          </Form.Item>
          <Form.Item name="note" label="Ghi chú nội bộ">
            <Input.TextArea rows={3} maxLength={2000} placeholder="Vì sao ứng viên này đáng chú ý?" />
          </Form.Item>
          <Button type="primary" htmlType="submit" block loading={mutation.isPending}>Lưu vào kho</Button>
        </Form>
      </Modal>
    </>
  )
}
