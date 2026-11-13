import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Form, Input, Modal } from 'antd'
import { useNavigate } from 'react-router'
import { DEFAULT_LAYOUT_KEY } from '@/entities/cv'
import { adminCvTemplates } from '@/entities/cv-template'
import { getApiErrorMessage } from '@/shared/api/error-mapper'
import { adminPath } from '@/shared/config/portals'
import { message } from '@/shared/lib/toast'
import LayoutPicker from './LayoutPicker'

// Tạo mẫu chỉ cần tên hai ngôn ngữ và bố cục; backend dựng sẵn các mục và bảng
// màu nên mẫu xem trước được ngay ở trang chỉnh sửa.
export default function CreateTemplateModal({ open, onClose }) {
  const [form] = Form.useForm()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const create = useMutation({
    mutationFn: (values) => adminCvTemplates.create({ ...values, name: values.display_name_vi.trim() }),
    onSuccess: (template) => {
      queryClient.invalidateQueries({ queryKey: ['admin-cv-templates'] })
      queryClient.setQueryData(['admin-cv-template', template.public_id], template)
      navigate(adminPath(`/cv/templates/${template.public_id}`))
    },
    onError: (error) => message.error(getApiErrorMessage(error, 'Không tạo được mẫu.')),
  })
  return <Modal open={open} title="Tạo mẫu CV" width={600} okText="Tạo mẫu" cancelText="Hủy" confirmLoading={create.isPending} onOk={() => form.submit()} onCancel={onClose} destroyOnHidden>
    <p className="mb-4 text-sm text-slate-500">Mẫu mới có sẵn các mục và bảng màu theo bố cục bạn chọn. Bạn chỉnh tiếp và xuất bản ở trang sau.</p>
    <Form form={form} layout="vertical" requiredMark={false} initialValues={{ renderer_key: DEFAULT_LAYOUT_KEY }} onFinish={create.mutate}>
      <div className="grid gap-x-3 sm:grid-cols-2">
        <Form.Item name="display_name_vi" label="Tên tiếng Việt" rules={[{ required: true, whitespace: true, message: 'Nhập tên mẫu' }, { max: 255 }]}><Input autoFocus placeholder="vd: Thanh lịch" /></Form.Item>
        <Form.Item name="display_name_en" label="Tên tiếng Anh" rules={[{ required: true, whitespace: true, message: 'Cần cho kho mẫu tiếng Anh' }, { max: 255 }]}><Input placeholder="vd: Elegant" /></Form.Item>
      </div>
      <Form.Item name="renderer_key" label="Bố cục" className="!mb-0"><LayoutPicker /></Form.Item>
    </Form>
  </Modal>
}
