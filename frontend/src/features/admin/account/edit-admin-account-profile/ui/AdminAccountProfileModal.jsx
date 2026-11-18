import { Form, Input, InputNumber, Modal, Select } from 'antd'
import { useEffect } from 'react'

const GENDER_OPTIONS = [
  { value: '', label: 'Chưa cập nhật' },
  { value: 'male', label: 'Nam' },
  { value: 'female', label: 'Nữ' },
  { value: 'other', label: 'Khác' },
]

function CandidateFields() {
  return (
    <>
      <Form.Item name="headline" label="Tiêu đề nghề nghiệp">
        <Input maxLength={255} />
      </Form.Item>
      <Form.Item name="current_position" label="Vị trí hiện tại">
        <Input maxLength={255} />
      </Form.Item>
      <Form.Item name="desired_position" label="Vị trí mong muốn">
        <Input maxLength={255} />
      </Form.Item>
      <Form.Item name="gender" label="Giới tính">
        <Select options={GENDER_OPTIONS} />
      </Form.Item>
      <Form.Item name="experience_years" label="Số năm kinh nghiệm">
        <InputNumber min={0} max={99} step={0.5} className="!w-full" />
      </Form.Item>
      <Form.Item name="education_level" label="Trình độ học vấn">
        <Input maxLength={255} />
      </Form.Item>
      <Form.Item name="address" label="Địa chỉ">
        <Input.TextArea rows={2} />
      </Form.Item>
      <Form.Item name="bio" label="Giới thiệu">
        <Input.TextArea rows={3} />
      </Form.Item>
      <Form.Item name="career_objective" label="Mục tiêu nghề nghiệp">
        <Input.TextArea rows={3} />
      </Form.Item>
      <Form.Item name="portfolio_url" label="Portfolio">
        <Input type="url" />
      </Form.Item>
      <Form.Item name="github_url" label="GitHub">
        <Input type="url" />
      </Form.Item>
      <Form.Item name="linkedin_url" label="LinkedIn">
        <Input type="url" />
      </Form.Item>
    </>
  )
}

function EmployerFields() {
  return (
    <>
      <Form.Item name="position_title" label="Chức danh">
        <Input maxLength={255} />
      </Form.Item>
      <Form.Item name="gender" label="Giới tính">
        <Select options={GENDER_OPTIONS} />
      </Form.Item>
      <Form.Item name="contact_phone" label="Số liên hệ">
        <Input maxLength={20} />
      </Form.Item>
    </>
  )
}

export default function AdminAccountProfileModal({
  account,
  profile,
  open,
  loading,
  onCancel,
  onSubmit,
}) {
  const [form] = Form.useForm()
  useEffect(() => {
    if (!open) return
    form.setFieldsValue({
      full_name: account?.full_name,
      phone: account?.phone?.startsWith('***') ? '' : account?.phone,
      ...(account?.role === 'candidate' ? profile?.candidate : profile?.employer),
    })
  }, [account, form, open, profile])

  return (
    <Modal
      open={open}
      title="Sửa hồ sơ an toàn"
      width={680}
      okText="Lưu thay đổi"
      cancelText="Hủy"
      confirmLoading={loading}
      onCancel={onCancel}
      onOk={() => form.validateFields().then(onSubmit)}
      destroyOnHidden
    >
      <Form
        form={form}
        layout="vertical"
        requiredMark={false}
        scrollToFirstError={{ focus: true }}
      >
        <div className="grid gap-x-4 md:grid-cols-2">
          <Form.Item
            name="full_name"
            label="Họ và tên"
            rules={[
              { required: true, message: 'Nhập họ và tên.' },
              { min: 2, message: 'Họ tên cần ít nhất 2 ký tự.' },
            ]}
          >
            <Input maxLength={255} />
          </Form.Item>
          <Form.Item name="phone" label="Điện thoại tài khoản">
            <Input maxLength={20} />
          </Form.Item>
          {account?.role === 'candidate' && <CandidateFields />}
          {account?.role === 'employer' && <EmployerFields />}
        </div>
      </Form>
    </Modal>
  )
}
