import { useState } from 'react'
import { App, Button, Form, Input } from 'antd'
import { updateProfile } from '@/features/edit-profile'
import { getApiErrorMessage } from '@/shared/api/error-mapper'
import { useAuth } from '@/features/auth'

// Số điện thoại VN: 0 hoặc +84 rồi 9-10 chữ số (khớp validate backend).
const PHONE_PATTERN = /^(0|\+84)\d{9,10}$/

// Trang "Cài đặt thông tin cá nhân": sửa họ tên + SĐT nhiều lần; email khoá
// (đổi email đi qua luồng xác thực riêng). Card trắng trên nền xám của layout.
export default function PersonalInfo() {
  const { user, setAuthenticatedUser } = useAuth()
  const { message } = App.useApp()
  const [form] = Form.useForm()
  const [saving, setSaving] = useState(false)

  async function handleSave(values) {
    setSaving(true)
    try {
      const updated = await updateProfile({
        full_name: values.full_name.trim(),
        phone: (values.phone || '').trim(),
      })
      setAuthenticatedUser(updated)
      form.setFieldsValue({ full_name: updated.full_name, phone: updated.phone })
      message.success('Đã lưu thông tin cá nhân.')
    } catch (error) {
      // Ưu tiên gắn lỗi vào đúng ô nếu backend trả lỗi theo field.
      const fieldErrors = error?.response?.data
      if (fieldErrors && typeof fieldErrors === 'object' && !Array.isArray(fieldErrors)) {
        const entries = Object.entries(fieldErrors).filter(([name]) => ['full_name', 'phone'].includes(name))
        if (entries.length) {
          form.setFields(entries.map(([name, errs]) => ({ name, errors: [].concat(errs) })))
          setSaving(false)
          return
        }
      }
      message.error(getApiErrorMessage(error, 'Không lưu được thông tin. Vui lòng thử lại.'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <h1 className="text-lg font-bold text-slate-900 sm:text-xl">Cài đặt thông tin cá nhân</h1>
      <p className="mt-1 text-sm text-slate-500">
        <span className="font-semibold text-red-500">(*)</span> Các thông tin bắt buộc
      </p>

      <Form
        form={form}
        layout="vertical"
        requiredMark={false}
        initialValues={{ full_name: user?.full_name || '', phone: user?.phone || '' }}
        onFinish={handleSave}
        className="mt-5 max-w-xl"
      >
        <Form.Item
          name="full_name"
          label={<span className="text-sm font-semibold text-slate-800">Họ và tên <span className="text-red-500">*</span></span>}
          rules={[
            { required: true, whitespace: true, message: 'Vui lòng nhập họ và tên.' },
            { min: 2, message: 'Họ và tên cần ít nhất 2 ký tự.' },
            { max: 255, message: 'Họ và tên quá dài.' },
          ]}
        >
          <Input size="large" placeholder="Nhập họ và tên" allowClear />
        </Form.Item>

        <Form.Item
          name="phone"
          label={<span className="text-sm font-semibold text-slate-800">Số điện thoại</span>}
          rules={[{ pattern: PHONE_PATTERN, message: 'Số điện thoại không hợp lệ (VD: 0912345678).' }]}
        >
          <Input size="large" placeholder="Nhập số điện thoại" inputMode="tel" allowClear />
        </Form.Item>

        <Form.Item
          label={<span className="text-sm font-semibold text-slate-800">Email</span>}
          extra="Email dùng để đăng nhập và không thể thay đổi tại đây."
        >
          <Input size="large" value={user?.email || ''} disabled />
        </Form.Item>

        <Form.Item className="mt-2 !mb-0">
          <Button type="primary" size="large" htmlType="submit" loading={saving}>
            Lưu
          </Button>
        </Form.Item>
      </Form>
    </section>
  )
}
