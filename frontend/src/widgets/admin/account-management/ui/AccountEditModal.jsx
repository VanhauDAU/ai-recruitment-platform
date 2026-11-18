import { Form, Input, Modal } from 'antd'

export default function AccountEditModal({
  account,
  form,
  loading,
  onClose,
  onSave,
}) {
  return (
    <Modal
      open={Boolean(account)}
      title="Cập nhật hồ sơ tài khoản"
      okText="Lưu thay đổi"
      cancelText="Hủy"
      confirmLoading={loading}
      onCancel={onClose}
      onOk={onSave}
      destroyOnHidden
    >
      <p className="mb-5 text-sm leading-6 text-slate-500">
        Chỉ cập nhật thông tin liên hệ cơ bản. Email, loại tài khoản và quyền truy cập
        được quản lý bằng luồng riêng.
      </p>
      <Form form={form} layout="vertical" requiredMark={false}>
        <Form.Item
          name="full_name"
          label="Họ và tên"
          rules={[
            { required: true, message: 'Nhập họ tên.' },
            { min: 2, message: 'Họ tên cần ít nhất 2 ký tự.' },
          ]}
        >
          <Input autoFocus placeholder="Nguyễn Văn An" maxLength={255} />
        </Form.Item>
        <Form.Item
          name="phone"
          label="Số điện thoại"
          rules={[{
            pattern: /^[+\d][\d\s.-]{7,19}$/,
            message: 'Số điện thoại chưa đúng định dạng.',
          }]}
        >
          <Input placeholder="090 123 4567" maxLength={20} />
        </Form.Item>
      </Form>
    </Modal>
  )
}
