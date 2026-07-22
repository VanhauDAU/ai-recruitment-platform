import { useEffect } from 'react'
import { Button, Form, Input } from 'antd'

export default function CampaignForm({ initialValues, submitting, onSubmit, onCancel }) {
  const [form] = Form.useForm()

  useEffect(() => {
    form.setFieldsValue({ name: initialValues?.name })
  }, [form, initialValues])

  return (
    <Form form={form} layout="vertical" onFinish={onSubmit}>
      <Form.Item
        name="name"
        label="Tên chiến dịch"
        rules={[{ required: true, whitespace: true, message: 'Nhập tên chiến dịch.' }]}
      >
        <Input autoFocus maxLength={255} placeholder="Ví dụ: Tuyển kỹ sư quý III/2026" />
      </Form.Item>
      <div className="mt-2 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button onClick={onCancel}>Hủy</Button>
        <Button type="primary" htmlType="submit" loading={submitting}>Lưu chiến dịch</Button>
      </div>
    </Form>
  )
}
