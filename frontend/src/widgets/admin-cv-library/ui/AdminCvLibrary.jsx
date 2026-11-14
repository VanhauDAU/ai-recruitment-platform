import { DeleteOutlined, EditOutlined, PlusOutlined, UploadOutlined } from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Alert, Button, Form, Input, Modal, Select, Switch, Table, Tabs, Tag, Upload } from 'antd'
import { useState } from 'react'
import { useSearchParams } from 'react-router'
import { useAdminAccess } from '@/entities/admin-access'
import { adminCvBackgrounds, adminCvCategories, adminCvColors } from '@/entities/cv-template'
import { useSession } from '@/entities/session'
import { getApiErrorMessage } from '@/shared/api/error-mapper'
import { message } from '@/shared/lib/toast'
import { AdminPanel } from '@/shared/ui/admin'
import { contrastRatio } from '../model/contrast'

const CATEGORY_TYPES = { style: 'Phong cách', feature: 'Đặc điểm', audience: 'Đối tượng' }
const HINTS = {
  colors: 'Ứng viên chọn màu trong danh sách màu của từng mẫu. Nhãn "AA" nghĩa là chữ đủ tương phản để đọc trên nền màu đó.',
  categories: 'Danh mục giúp ứng viên lọc kho mẫu theo phong cách, đặc điểm và đối tượng.',
  backgrounds: 'Hình nền ứng viên chọn trong editor (JPG, PNG, WebP).',
}

function ContrastBadges({ hex }) {
  return <span className="flex flex-wrap gap-1">{[['#FFFFFF', 'chữ trắng'], ['#000000', 'chữ đen']].map(([text, label]) => {
    const ratio = contrastRatio(hex, text)
    return <Tag key={text} color={ratio >= 4.5 ? 'green' : 'default'}>{label} {ratio.toFixed(1)}{ratio >= 4.5 ? ' · AA' : ''}</Tag>
  })}</span>
}

const COLLECTIONS = {
  colors: {
    api: adminCvColors,
    title: 'Màu',
    fields: [{ name: 'name', label: 'Tên màu' }, { name: 'hex_code', label: 'Mã màu (#RRGGBB)', rules: [{ pattern: /^#[0-9A-Fa-f]{6}$/, message: 'Dạng #RRGGBB' }] }],
    columns: [
      { title: 'Màu', dataIndex: 'hex_code', render: (hex, row) => <span className="flex items-center gap-2"><span className="h-6 w-6 shrink-0 rounded border border-slate-200" style={{ background: hex }} /><span>{row.name}</span></span> },
      { title: 'Mã', dataIndex: 'hex_code', responsive: ['md'] },
      { title: 'Tương phản', dataIndex: 'hex_code', render: (hex) => <ContrastBadges hex={hex} />, responsive: ['md'] },
    ],
  },
  categories: {
    api: adminCvCategories,
    title: 'Danh mục',
    fields: [
      { name: 'category_type', label: 'Nhóm', options: Object.entries(CATEGORY_TYPES).map(([value, label]) => ({ value, label })) },
      { name: 'name', label: 'Tên' },
      { name: 'slug', label: 'Slug', required: false },
    ],
    columns: [
      { title: 'Tên', dataIndex: 'name' },
      { title: 'Nhóm', dataIndex: 'category_type', render: (type) => CATEGORY_TYPES[type] || type },
      { title: 'Slug', dataIndex: 'slug', responsive: ['md'] },
    ],
  },
}

function CollectionTab({ kind, canManage, canPublish }) {
  const config = COLLECTIONS[kind]
  const queryClient = useQueryClient()
  const [editing, setEditing] = useState(null)
  const [form] = Form.useForm()
  const { data = [], isLoading } = useQuery({ queryKey: ['admin-cv-library', kind], queryFn: () => config.api.list() })
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['admin-cv-library', kind] })
  const run = useMutation({
    mutationFn: ({ action, row, values }) => (action === 'remove' ? config.api.remove(row.public_id) : action === 'update' ? config.api.update(row.public_id, values) : config.api.create(values)),
    onSuccess: () => { refresh(); setEditing(null); message.success('Đã lưu.') },
    onError: (error) => message.error(getApiErrorMessage(error, 'Không thể lưu.')),
  })
  const open = (row) => { form.setFieldsValue(row || { category_type: 'style' }); setEditing(row || {}) }
  const columns = [
    ...config.columns,
    { title: 'Mẫu dùng', dataIndex: 'template_count', align: 'right', width: 96 },
    { title: 'Hiển thị', dataIndex: 'is_active', width: 90, render: (active, row) => <Switch size="small" checked={active} disabled={!canPublish} aria-label={`Hiển thị ${row.name}`} onChange={(is_active) => run.mutate({ action: 'update', row, values: { is_active } })} /> },
    ...(canManage ? [{ title: '', width: 96, render: (_, row) => <span className="flex gap-1"><Button size="small" type="text" icon={<EditOutlined />} aria-label={`Sửa ${row.name}`} onClick={() => open(row)} /><Button size="small" type="text" danger icon={<DeleteOutlined />} aria-label={`Xóa ${row.name}`} disabled={row.template_count > 0} title={row.template_count > 0 ? 'Đang được mẫu CV dùng' : undefined} onClick={() => run.mutate({ action: 'remove', row })} /></span> }] : []),
  ]
  return <AdminPanel padded={false} title={config.title} extra={canManage && <Button size="small" type="primary" icon={<PlusOutlined />} onClick={() => open(null)}>Thêm</Button>}>
    <Table size="small" rowKey="public_id" loading={isLoading} dataSource={data} columns={columns} pagination={{ pageSize: 20, hideOnSinglePage: true }} scroll={{ x: 560 }} />
    <Modal open={Boolean(editing)} title={editing?.public_id ? `Sửa ${config.title.toLowerCase()}` : `Thêm ${config.title.toLowerCase()}`} okText="Lưu" cancelText="Hủy" confirmLoading={run.isPending} onCancel={() => setEditing(null)} onOk={() => form.validateFields().then((values) => run.mutate({ action: editing?.public_id ? 'update' : 'create', row: editing, values }))}>
      <Form form={form} layout="vertical">{config.fields.map((field) => <Form.Item key={field.name} name={field.name} label={field.label} rules={[...(field.required === false ? [] : [{ required: true, message: 'Bắt buộc' }]), ...(field.rules || [])]}>{field.options ? <Select options={field.options} /> : <Input />}</Form.Item>)}</Form>
    </Modal>
  </AdminPanel>
}

function BackgroundsTab({ canManage, canPublish }) {
  const queryClient = useQueryClient()
  const { data = [], isLoading } = useQuery({ queryKey: ['admin-cv-library', 'backgrounds'], queryFn: () => adminCvBackgrounds.list() })
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['admin-cv-library', 'backgrounds'] })
  const run = useMutation({
    mutationFn: ({ action, row, values, file }) => (action === 'upload' ? adminCvBackgrounds.create(file) : action === 'remove' ? adminCvBackgrounds.remove(row.public_id) : adminCvBackgrounds.update(row.public_id, values)),
    onSuccess: () => { refresh(); message.success('Đã lưu.') },
    onError: (error) => message.error(getApiErrorMessage(error, 'Không thể lưu hình nền.')),
  })
  return <AdminPanel padded={false} title="Hình nền" extra={canManage && <Upload accept="image/png,image/jpeg,image/webp" showUploadList={false} beforeUpload={(file) => { run.mutate({ action: 'upload', file }); return false }}><Button size="small" type="primary" icon={<UploadOutlined />} loading={run.isPending}>Tải lên</Button></Upload>}>
    <Table size="small" rowKey="public_id" loading={isLoading} dataSource={data} pagination={{ pageSize: 20, hideOnSinglePage: true }} scroll={{ x: 520 }} columns={[
      { title: 'Ảnh', dataIndex: 'url', width: 88, render: (url, row) => url ? <img src={url} alt={row.title || 'Hình nền'} className="h-14 w-10 rounded border border-slate-200 object-cover" loading="lazy" /> : null },
      { title: 'Tên', dataIndex: 'title', render: (title) => title || 'Chưa đặt tên' },
      { title: 'Kích thước', render: (_, row) => `${row.width}×${row.height}`, responsive: ['md'] },
      { title: 'Hiển thị', dataIndex: 'is_active', width: 90, render: (active, row) => <Switch size="small" checked={active} disabled={!canPublish} aria-label={`Hiển thị ${row.title || row.public_id}`} onChange={(is_active) => run.mutate({ action: 'update', row, values: { is_active } })} /> },
      ...(canManage ? [{ title: '', width: 56, render: (_, row) => <Button size="small" type="text" danger icon={<DeleteOutlined />} aria-label={`Xóa ${row.title || row.public_id}`} onClick={() => run.mutate({ action: 'remove', row })} /> }] : []),
    ]} />
  </AdminPanel>
}

export default function AdminCvLibrary() {
  const { user } = useSession()
  const access = useAdminAccess(user)
  const [params, setParams] = useSearchParams()
  const permissions = { canManage: access.has('cv_template.manage'), canPublish: access.has('cv_template.publish') }
  const tab = ['colors', 'categories', 'backgrounds'].includes(params.get('tab')) ? params.get('tab') : 'colors'
  const withHint = (key, content) => <div className="space-y-3"><Alert type="info" showIcon message={HINTS[key]} />{content}</div>
  return <Tabs activeKey={tab} onChange={(next) => setParams({ tab: next }, { replace: true })} items={[
    { key: 'colors', label: 'Màu', children: withHint('colors', <CollectionTab kind="colors" {...permissions} />) },
    { key: 'categories', label: 'Danh mục', children: withHint('categories', <CollectionTab kind="categories" {...permissions} />) },
    { key: 'backgrounds', label: 'Hình nền', children: withHint('backgrounds', <BackgroundsTab {...permissions} />) },
  ]} />
}
