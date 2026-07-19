import { CameraOutlined, DownloadOutlined, LinkOutlined } from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import { App, Avatar, Button, Form, Input, Select } from 'antd'
import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { getEmployerProfile } from '@/entities/employer-profile'
import { useSession } from '@/entities/session'
import { updateProfile, uploadAvatar } from '@/features/edit-profile'
import { getApiErrorMessage } from '@/shared/api/error-mapper'
import { EMPLOYER_PHONE_VERIFY_URL } from '@/shared/config/portals'

const PHONE_PATTERN = /^(0|\+84)\d{9,10}$/
const GENDER_LABELS = { male: 'Nam', female: 'Nữ', other: 'Khác' }

export default function EmployerAccountInformation() {
  const { user, setCurrentUser } = useSession()
  const { message } = App.useApp()
  const profileQuery = useQuery({ queryKey: ['employer', 'profile'], queryFn: getEmployerProfile })
  const [saving, setSaving] = useState(false)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [phoneEditing, setPhoneEditing] = useState(false)
  const [form] = Form.useForm()
  const avatarInputRef = useRef(null)

  useEffect(() => {
    form.setFieldsValue({ full_name: user?.full_name || '', phone: user?.phone || '' })
  }, [form, user?.full_name, user?.phone])

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

  async function handleAvatarChange(event) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    if (file.size > 5 * 1024 * 1024) {
      message.error('Ảnh đại diện không được vượt quá 5MB.')
      return
    }
    setUploadingAvatar(true)
    try {
      const updated = await uploadAvatar(file)
      setCurrentUser(updated)
      message.success('Đã cập nhật ảnh đại diện.')
    } catch (error) {
      message.error(getApiErrorMessage(error, 'Không thể cập nhật ảnh đại diện.'))
    } finally {
      setUploadingAvatar(false)
    }
  }

  function handleExport() {
    const data = {
      full_name: user?.full_name || '',
      email: user?.email || '',
      phone: user?.phone || '',
      gender: profileQuery.data?.gender || '',
      exported_at: new Date().toISOString(),
    }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = 'thong-tin-tai-khoan.json'
    anchor.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="overflow-hidden rounded-sm border border-slate-200 bg-white">
      <div className="flex items-center justify-between border-b border-slate-200 px-4 py-4 sm:px-5">
        <h2 className="text-sm font-bold text-slate-800">Cập nhật thông tin tài khoản</h2>
        <Button size="small" icon={<DownloadOutlined />} onClick={handleExport} className="!border-emerald-500 !text-emerald-600">Xuất dữ liệu</Button>
      </div>

      <Form
        form={form}
        layout="vertical"
        requiredMark={false}
        onFinish={handleSave}
        className="px-4 py-5 sm:px-5 sm:py-6"
      >
        <div className="grid gap-x-8 sm:grid-cols-2">
          <div className="mb-5 flex items-center gap-3 sm:col-span-2">
            <span className="text-sm text-slate-600">Avatar</span>
            <Avatar size={36} src={user?.avatar_url || undefined} className="!bg-slate-100 !text-slate-500">
              {(user?.full_name || user?.email || 'N').trim().charAt(0).toUpperCase()}
            </Avatar>
            <input ref={avatarInputRef} type="file" accept="image/png,image/jpeg,image/gif,image/webp" className="!hidden" onChange={handleAvatarChange} />
            <Button size="small" icon={<CameraOutlined />} loading={uploadingAvatar} onClick={() => avatarInputRef.current?.click()}>Đổi avatar</Button>
          </div>

          <Form.Item name="full_name" label="Họ và tên" rules={[{ required: true, whitespace: true, message: 'Vui lòng nhập họ và tên.' }, { min: 2, message: 'Họ và tên cần ít nhất 2 ký tự.' }, { max: 255, message: 'Họ và tên quá dài.' }]}>
            <Input placeholder="Nhập họ và tên" />
          </Form.Item>

          <Form.Item label="Giới tính">
            <Select disabled value={profileQuery.data?.gender || undefined} placeholder="Chưa cập nhật" options={Object.entries(GENDER_LABELS).map(([value, label]) => ({ value, label }))} />
          </Form.Item>

          <Form.Item label="Email">
            <span className="flex min-h-8 items-center text-sm text-slate-600">{user?.email || '—'}</span>
          </Form.Item>

          <Form.Item
            name="phone"
            label={(
              <span className="flex items-center gap-2">
                <span>Số điện thoại</span>
                <Button type="link" size="small" onClick={() => setPhoneEditing((value) => !value)} className="!h-auto !p-0 !font-normal !text-emerald-600">{phoneEditing ? 'Khóa' : 'Cập nhật'}</Button>
                <span className="text-slate-300">|</span>
                <Link to={EMPLOYER_PHONE_VERIFY_URL} className="text-emerald-600"><LinkOutlined /> Xác thực</Link>
              </span>
            )}
            rules={[{ pattern: PHONE_PATTERN, message: 'Số điện thoại không hợp lệ (VD: 0912345678).' }]}
          >
            <Input disabled={!phoneEditing} inputMode="tel" placeholder="Nhập số điện thoại" />
          </Form.Item>
        </div>

        <div className="mt-1 flex justify-end gap-3 border-t border-slate-200 pt-4">
          <Button onClick={() => { form.resetFields(); setPhoneEditing(false) }} className="min-w-24">Hủy</Button>
          <Button type="primary" htmlType="submit" loading={saving} className="min-w-24 !bg-[#00b14f]">Lưu</Button>
        </div>
      </Form>
    </div>
  )
}
