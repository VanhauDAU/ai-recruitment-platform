import { useQuery } from '@tanstack/react-query'
import { Checkbox, Collapse, Form, Input, Select } from 'antd'
import { useEffect, useRef } from 'react'
import { adminCvCategories } from '@/entities/cv-template'
import { AdminPanel } from '@/shared/ui/admin'

const CATEGORY_GROUPS = { style: 'Phong cách', feature: 'Đặc điểm', audience: 'Đối tượng' }
const FIELDS = ['display_name_vi', 'display_name_en', 'category_public_ids', 'description_vi', 'description_en', 'slug', 'is_premium']
const AUTOSAVE_DELAY_MS = 800

// Tên, danh mục (và phần phụ: mô tả, đường dẫn, nổi bật). Tự lưu khi ngừng gõ.
export default function InfoCard({ template, canManage, onSave }) {
  const [form] = Form.useForm()
  const timer = useRef(null)
  const categories = useQuery({ queryKey: ['admin-cv-library', 'categories'], queryFn: () => adminCvCategories.list() })
  const options = Object.entries(CATEGORY_GROUPS).map(([type, label]) => ({
    label,
    options: (categories.data || []).filter((category) => category.category_type === type).map((category) => ({ value: category.public_id, label: category.name })),
  }))
  useEffect(() => () => clearTimeout(timer.current), [])

  const commit = async () => {
    const values = await form.validateFields().catch(() => null)
    if (!values) return
    const changed = Object.fromEntries(FIELDS.filter((key) => key in values && JSON.stringify(values[key] ?? '') !== JSON.stringify(template[key] ?? '')).map((key) => [key, values[key]]))
    if (changed.slug === '') delete changed.slug
    if (changed.display_name_vi) changed.name = changed.display_name_vi.trim()
    if (Object.keys(changed).length) onSave(changed)
  }
  const schedule = () => {
    clearTimeout(timer.current)
    timer.current = setTimeout(commit, AUTOSAVE_DELAY_MS)
  }

  return <AdminPanel title="Thông tin" description="Tên và danh mục ứng viên thấy trên kho mẫu.">
    <Form form={form} layout="vertical" requiredMark={false} disabled={!canManage} initialValues={template} onValuesChange={schedule}>
      <div className="grid gap-x-3 sm:grid-cols-2">
        <Form.Item name="display_name_vi" label="Tên tiếng Việt" rules={[{ required: true, whitespace: true, message: 'Nhập tên mẫu' }, { max: 255 }]}><Input /></Form.Item>
        <Form.Item name="display_name_en" label="Tên tiếng Anh" rules={[{ required: true, whitespace: true, message: 'Cần cho kho mẫu tiếng Anh' }, { max: 255 }]}><Input /></Form.Item>
      </div>
      <Form.Item name="category_public_ids" label="Danh mục" className="!mb-2"><Select mode="multiple" allowClear placeholder="Chọn để ứng viên lọc được" loading={categories.isLoading} options={options} optionFilterProp="label" /></Form.Item>
      <Collapse ghost size="small" className="-mx-3" items={[{
        key: 'more',
        label: <span className="text-sm text-slate-600">Mô tả, đường dẫn, mẫu nổi bật</span>,
        forceRender: true,
        children: <>
          <Form.Item name="description_vi" label="Mô tả tiếng Việt"><Input.TextArea autoSize={{ minRows: 2, maxRows: 4 }} /></Form.Item>
          <Form.Item name="description_en" label="Mô tả tiếng Anh"><Input.TextArea autoSize={{ minRows: 2, maxRows: 4 }} /></Form.Item>
          <Form.Item name="slug" label="Đường dẫn (slug)"><Input prefix={<span className="text-slate-400">/mau-cv/chi-tiet/</span>} /></Form.Item>
          <Form.Item name="is_premium" valuePropName="checked" className="!mb-0"><Checkbox>Đánh dấu mẫu nổi bật</Checkbox></Form.Item>
        </>,
      }]} />
    </Form>
  </AdminPanel>
}
