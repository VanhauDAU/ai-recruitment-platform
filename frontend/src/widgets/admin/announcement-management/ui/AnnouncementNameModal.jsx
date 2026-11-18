import { Form, Input, Modal } from 'antd'
import { useEffect } from 'react'

export default function AnnouncementNameModal({
  initialValue = '',
  mode,
  onCancel,
  onSubmit,
  open,
  pending,
}) {
  const [form] = Form.useForm()

  useEffect(() => {
    if (open) form.setFieldsValue({ internal_name: initialValue })
  }, [form, initialValue, open])

  const title = mode === 'rename' ? 'Đổi tên vận hành' : 'Nhân bản thông báo'
  return (
    <Modal
      open={open}
      title={title}
      okText={mode === 'rename' ? 'Lưu tên' : 'Tạo bản sao'}
      cancelText="Hủy"
      confirmLoading={pending}
      onCancel={onCancel}
      onOk={() => form.validateFields().then(onSubmit)}
      destroyOnHidden
    >
      <Form form={form} layout="vertical">
        <Form.Item
          name="internal_name"
          label="Tên vận hành"
          rules={[
            { required: true, whitespace: true, message: 'Nhập tên vận hành.' },
            { max: 200, message: 'Tên tối đa 200 ký tự.' },
          ]}
        >
          <Input autoFocus maxLength={200} showCount />
        </Form.Item>
      </Form>
    </Modal>
  )
}
