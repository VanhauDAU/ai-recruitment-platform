import { Button, Form, Input } from 'antd'
import { useEffect } from 'react'

export default function CampaignNameForm({
  initialName = '',
  submitting,
  onSubmit,
  onCancel,
}) {
  const [form] = Form.useForm()

  useEffect(() => {
    form.setFieldsValue({ name: initialName })
  }, [form, initialName])

  return (
    <Form
      form={form}
      layout="vertical"
      onFinish={({ name }) => onSubmit({ name: name.trim() })}
    >
      <Form.Item
        name="name"
        label="Tên chiến dịch tuyển dụng"
        rules={[{ required: true, whitespace: true, message: 'Nhập tên chiến dịch.' }]}
      >
        <Input
          autoFocus
          maxLength={255}
          className="!h-11 !rounded-xl !border-slate-300 transition-shadow focus-within:!border-emerald-500 focus-within:!shadow-[0_0_0_3px_rgba(16,185,129,0.14)]"
          placeholder="Ví dụ: Tuyển dụng nhân viên Marketing tháng 10"
        />
      </Form.Item>
      <div className="flex justify-end gap-2">
        <Button
          className="!h-10 !rounded-xl !border-slate-200 !px-4 !font-semibold !text-slate-600 transition-all duration-200 hover:!border-slate-300 hover:!bg-slate-50 hover:!text-slate-900"
          onClick={onCancel}
        >
          Hủy
        </Button>
        <Button
          type="primary"
          htmlType="submit"
          loading={submitting}
          className="!h-10 !rounded-xl !border-0 !bg-gradient-to-r !from-emerald-600 !to-teal-600 !px-5 !font-semibold !shadow-md transition-all duration-200 hover:!-translate-y-0.5 hover:!from-emerald-500 hover:!to-teal-500 hover:!shadow-lg active:!translate-y-0"
        >
          Lưu thay đổi
        </Button>
      </div>
    </Form>
  )
}
