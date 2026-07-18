import { App, Button, Form, Input } from 'antd'
import { useState } from 'react'
import { useSession } from '@/entities/session'
import { updateProfile } from '@/features/edit-profile'
import { getApiErrorMessage } from '@/shared/api/error-mapper'

const PHONE_PATTERN = /^(0|\+84)\d{9,10}$/

export default function EmployerAccountInformation() {
  const { user, setCurrentUser } = useSession()
  const { message } = App.useApp()
  const [saving, setSaving] = useState(false)
  const [form] = Form.useForm()

  async function handleSave(values) {
    setSaving(true)
    try {
      const updated = await updateProfile({
        full_name: values.full_name.trim(),
        phone: (values.phone || '').trim(),
      })
      setCurrentUser(updated)
      form.setFieldsValue({ full_name: updated.full_name, phone: updated.phone })
      message.success('Đã cập nhật thông tin tài khoản.')
    } catch (error) {
      const fieldErrors = error?.response?.data
      if (fieldErrors && typeof fieldErrors === 'object' && !Array.isArray(fieldErrors)) {
        const entries = Object.entries(fieldErrors).filter(([name]) => ['full_name', 'phone'].includes(name))
        if (entries.length) {
          form.setFields(entries.map(([name, errors]) => ({ name, errors: [].concat(errors) })))
          return
        }
      }
      message.error(getApiErrorMessage(error, 'Không thể lưu thông tin. Vui lòng thử lại.'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Form
      form={form}
      layout="vertical"
      requiredMark={false}
      initialValues={{ full_name: user?.full_name || '', phone: user?.phone || '' }}
      onFinish={handleSave}
      className="max-w-3xl"
    >
      <div className="grid gap-x-4 sm:grid-cols-2">
        <Form.Item name="full_name" label="Họ và tên" rules={[{ required: true, whitespace: true, message: 'Vui lòng nhập họ và tên.' }, { min: 2, message: 'Họ và tên cần ít nhất 2 ký tự.' }, { max: 255, message: 'Họ và tên quá dài.' }]}>
          <Input size="large" placeholder="Nhập họ và tên" />
        </Form.Item>
        <Form.Item name="phone" label="Số điện thoại" rules={[{ pattern: PHONE_PATTERN, message: 'Số điện thoại không hợp lệ (VD: 0912345678).' }]}>
          <Input size="large" inputMode="tel" placeholder="Nhập số điện thoại" />
        </Form.Item>
        <Form.Item label="Email" className="sm:col-span-2" extra="Email dùng để đăng nhập và không thể thay đổi tại đây.">
          <Input size="large" value={user?.email || ''} disabled />
        </Form.Item>
      </div>
      <div className="flex gap-3">
        <Button size="large" onClick={() => form.resetFields()} className="min-w-24">Hủy</Button>
        <Button type="primary" size="large" htmlType="submit" loading={saving} className="min-w-24">Cập nhật</Button>
      </div>
    </Form>
  )
}
