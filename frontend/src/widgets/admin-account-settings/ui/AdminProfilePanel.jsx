import { CheckCircleFilled, ExclamationCircleFilled, UploadOutlined, UserOutlined } from '@ant-design/icons'
import { Avatar, Button, Card, Form, Input, Tag, Upload } from 'antd'
import { useState } from 'react'
import { useAdminAccess } from '@/entities/admin-access'
import { useSession } from '@/entities/session'
import { updateProfile, uploadAvatar } from '@/features/edit-profile'
import { getApiErrorMessage } from '@/shared/api/error-mapper'
import { message } from '@/shared/lib/toast'
import { primaryDepartmentLabel } from '../model/department-label'

const ROLE_LABELS = { admin: 'Quản trị viên', employer: 'Nhà tuyển dụng', candidate: 'Ứng viên' }

export default function AdminProfilePanel() {
  const { user, setCurrentUser } = useSession()
  const adminAccess = useAdminAccess(user)
  const [form] = Form.useForm()
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)

  async function submit(values) {
    setSaving(true)
    try {
      setCurrentUser(await updateProfile(values))
      message.success('Đã cập nhật thông tin tài khoản.')
    } catch (error) {
      message.error(getApiErrorMessage(error, 'Không thể cập nhật thông tin.'))
    } finally {
      setSaving(false)
    }
  }

  async function handleAvatar(file) {
    setUploading(true)
    try {
      setCurrentUser(await uploadAvatar(file))
      message.success('Đã cập nhật ảnh đại diện.')
    } catch (error) {
      message.error(getApiErrorMessage(error, 'Không thể tải ảnh lên.'))
    } finally {
      setUploading(false)
    }
    // Trả false để antd không tự upload — file đã được gửi bằng API của app.
    return false
  }

  return (
    <div className="space-y-5">
      <Card title="Ảnh đại diện">
        <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
          <Avatar size={72} src={user?.avatar_url || undefined} icon={<UserOutlined />} />
          <div>
            <Upload accept="image/*" showUploadList={false} beforeUpload={handleAvatar}>
              <Button icon={<UploadOutlined />} loading={uploading}>Tải ảnh lên</Button>
            </Upload>
            <p className="mb-0 mt-2 text-xs text-slate-500">JPG, PNG, GIF hoặc WebP, tối đa 5MB.</p>
          </div>
        </div>
      </Card>

      <Card title="Thông tin liên hệ">
        <Form
          form={form}
          layout="vertical"
          className="max-w-xl"
          initialValues={{ full_name: user?.full_name || '', phone: user?.phone || '' }}
          onFinish={submit}
        >
          <Form.Item
            name="full_name"
            label="Họ và tên"
            extra="Tên này hiển thị trên thanh điều hướng và trong nhật ký thao tác."
            rules={[{ max: 255, message: 'Họ tên tối đa 255 ký tự.' }]}
          >
            <Input placeholder="Nguyễn Văn A" />
          </Form.Item>
          <Form.Item
            name="phone"
            label="Số điện thoại"
            rules={[{ pattern: /^[0-9+\-\s]{0,20}$/, message: 'Số điện thoại không hợp lệ.' }]}
          >
            <Input placeholder="0901234567" />
          </Form.Item>
          <Button type="primary" htmlType="submit" loading={saving}>Lưu thay đổi</Button>
        </Form>
      </Card>

      <Card title="Tài khoản đăng nhập">
        <dl className="m-0 grid gap-4 sm:grid-cols-2">
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">Email</dt>
            <dd className="mb-0 mt-1 flex flex-wrap items-center gap-2 break-all font-medium text-slate-800">
              {user?.email}
              {user?.email_verified ? (
                <Tag color="green" icon={<CheckCircleFilled />} className="!m-0">Đã xác minh</Tag>
              ) : (
                <Tag color="orange" icon={<ExclamationCircleFilled />} className="!m-0">Chưa xác minh</Tag>
              )}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">Vai trò</dt>
            <dd className="mb-0 mt-1 flex flex-wrap items-center gap-2 font-medium text-slate-800">
              {ROLE_LABELS[user?.role] || user?.role}
              {adminAccess.isSuperuser && <Tag color="gold" className="!m-0">Superuser</Tag>}
            </dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">Phòng ban</dt>
            <dd className="mb-0 mt-1 text-slate-800">
              {adminAccess.primaryDepartment ? (
                <Tag color="green">
                  {primaryDepartmentLabel(adminAccess.primaryDepartment, adminAccess.memberships)}
                </Tag>
              ) : (
                <span className="text-slate-500">Chưa được gán phòng ban.</span>
              )}
            </dd>
          </div>
        </dl>
        <p className="mb-0 mt-4 text-sm text-slate-500">
          Email đăng nhập không đổi được tại đây. Liên hệ quản trị hệ thống (superuser) nếu cần thay đổi.
        </p>
      </Card>
    </div>
  )
}
