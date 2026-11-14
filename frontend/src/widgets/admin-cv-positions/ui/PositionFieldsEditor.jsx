import { DeleteOutlined, EditOutlined, MinusCircleOutlined, PlusOutlined } from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Button, Checkbox, Form, Input, Modal, Select, Table, Tag } from 'antd'
import { useState } from 'react'
import { adminCvPositionFields } from '@/entities/cv-template'
import { PositionDetailField } from '@/features/edit-cv-draft'
import { getApiErrorMessage } from '@/shared/api/error-mapper'
import { message } from '@/shared/lib/toast'
import { FIELD_TYPES } from '../model/catalog'

const typeLabel = (type) => FIELD_TYPES.find((item) => item.value === type)?.label || type
const CHOICE = ['select', 'multi_select']

// Xem trước đúng ô ứng viên sẽ điền trong editor (nhãn tiếng Việt).
function CandidatePreview({ fields }) {
  const [values, setValues] = useState({})
  const items = fields.filter((field) => field.is_active).map((field) => ({ item_id: field.public_id, field_key: field.key, label: field.label_vi, placeholder: field.placeholder_vi, field_type: field.field_type, options: field.options.map((option) => option.vi), value: values[field.key] ?? (['multi_select', 'tags'].includes(field.field_type) ? [] : '') }))
  if (items.length === 0) return null
  return <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4"><p className="mb-1 text-sm font-semibold">Ứng viên sẽ điền như thế này</p><p className="mb-3 text-xs font-bold uppercase text-slate-500">Thông tin chuyên môn</p>{items.map((item) => <PositionDetailField key={item.item_id} item={item} locale="vi-VN" onChange={({ value }) => setValues({ ...values, [item.field_key]: value })} />)}</div>
}

export default function PositionFieldsEditor({ positionPublicId, canManage, onChanged }) {
  const queryClient = useQueryClient()
  const [form] = Form.useForm()
  const [editing, setEditing] = useState(null)
  const fieldType = Form.useWatch('field_type', form)
  const queryKey = ['admin-cv-position-fields', positionPublicId]
  const { data = [], isLoading } = useQuery({ queryKey, queryFn: () => adminCvPositionFields.list({ position: positionPublicId }) })
  const run = useMutation({
    mutationFn: ({ action, row, values }) => (action === 'remove' ? adminCvPositionFields.remove(row.public_id) : action === 'update' ? adminCvPositionFields.update(row.public_id, values) : adminCvPositionFields.create({ ...values, position_public_id: positionPublicId })),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey })
      queryClient.invalidateQueries({ queryKey: ['admin-cv-positions'] })
      setEditing(null)
      onChanged?.()
      message.success('Đã lưu.')
    },
    onError: (error) => message.error(getApiErrorMessage(error, 'Không thể lưu câu hỏi.')),
  })
  const open = (row) => {
    form.resetFields()
    form.setFieldsValue(row || { field_type: 'text', maps_to: 'none', options: [], is_active: true, sort_order: data.length })
    setEditing(row || {})
  }
  const submit = () => form.validateFields().then((values) => run.mutate({
    action: editing?.public_id ? 'update' : 'create',
    row: editing,
    values: { ...values, options: CHOICE.includes(values.field_type) ? values.options : [], maps_to: ['multi_select', 'tags'].includes(values.field_type) ? values.maps_to : 'none' },
  }))
  return <div className="space-y-4">
    <div>
      {canManage && <Button className="mb-3" type="primary" icon={<PlusOutlined />} onClick={() => open(null)}>Thêm câu hỏi</Button>}
      <Table size="small" rowKey="public_id" loading={isLoading} dataSource={data} pagination={false} scroll={{ x: 460 }} locale={{ emptyText: 'Vị trí chưa có câu hỏi riêng. CV sẽ không có mục "Thông tin chuyên môn".' }} columns={[
        { title: 'Câu hỏi', dataIndex: 'label_vi', render: (label, row) => <span>{label}<span className="block font-mono text-xs text-slate-400">{row.key}</span></span> },
        { title: 'Kiểu trả lời', dataIndex: 'field_type', render: (type, row) => <span className="flex flex-wrap gap-1"><Tag>{typeLabel(type)}</Tag>{row.maps_to === 'skills' && <Tag color="blue">Tính là kỹ năng</Tag>}{!row.is_active && <Tag>Đang tắt</Tag>}</span> },
        ...(canManage ? [{ title: '', width: 80, render: (_, row) => <span className="flex gap-1"><Button size="small" type="text" icon={<EditOutlined />} aria-label={`Sửa ${row.key}`} onClick={() => open(row)} /><Button size="small" type="text" danger icon={<DeleteOutlined />} aria-label={`Xóa ${row.key}`} onClick={() => run.mutate({ action: 'remove', row })} /></span> }] : []),
      ]} />
    </div>
    <CandidatePreview fields={data} />
    <Modal open={Boolean(editing)} width={640} title={editing?.public_id ? 'Sửa câu hỏi' : 'Thêm câu hỏi riêng của nghề'} okText="Lưu" cancelText="Hủy" confirmLoading={run.isPending} onCancel={() => setEditing(null)} onOk={submit}>
      <Form form={form} layout="vertical" className="grid gap-x-3 sm:grid-cols-2">
        <Form.Item name="key" label="Mã (không dấu, không đổi được sau khi tạo)" rules={[{ required: true, pattern: /^[a-z][a-z0-9_]{0,49}$/, message: 'Chữ thường, số, gạch dưới' }]}><Input placeholder="github_url" disabled={Boolean(editing?.public_id)} /></Form.Item>
        <Form.Item name="field_type" label="Kiểu trả lời" rules={[{ required: true }]}><Select options={FIELD_TYPES} /></Form.Item>
        <Form.Item name="label_vi" label="Câu hỏi (tiếng Việt)" rules={[{ required: true, max: 100 }]}><Input /></Form.Item>
        <Form.Item name="label_en" label="Câu hỏi (tiếng Anh)" rules={[{ required: true, max: 100 }]}><Input /></Form.Item>
        <Form.Item name="placeholder_vi" label="Ví dụ mẫu (tiếng Việt)"><Input /></Form.Item>
        <Form.Item name="placeholder_en" label="Ví dụ mẫu (tiếng Anh)"><Input /></Form.Item>
        {CHOICE.includes(fieldType) && <Form.List name="options">{(rows, { add, remove }) => <div className="sm:col-span-2"><p className="mb-1 text-sm">Lựa chọn</p>{rows.map((row) => <div key={row.key} className="mb-2 flex gap-2"><Form.Item name={[row.name, 'vi']} noStyle rules={[{ required: true }]}><Input placeholder="Tiếng Việt" /></Form.Item><Form.Item name={[row.name, 'en']} noStyle rules={[{ required: true }]}><Input placeholder="Tiếng Anh" /></Form.Item><Button type="text" icon={<MinusCircleOutlined />} aria-label="Bỏ lựa chọn" onClick={() => remove(row.name)} /></div>)}<Button size="small" icon={<PlusOutlined />} onClick={() => add({ vi: '', en: '' })}>Thêm lựa chọn</Button></div>}</Form.List>}
        {['multi_select', 'tags'].includes(fieldType) && <Form.Item name="maps_to" label="Câu trả lời có phải kỹ năng không?" className="sm:col-span-2"><Select options={[{ value: 'none', label: 'Không' }, { value: 'skills', label: 'Có — dùng để gợi ý việc làm phù hợp' }]} /></Form.Item>}
        <Form.Item name="is_required_hint" valuePropName="checked"><Checkbox>Nhắc ứng viên nên điền</Checkbox></Form.Item>
        <Form.Item name="is_active" valuePropName="checked"><Checkbox>Đang dùng</Checkbox></Form.Item>
      </Form>
    </Modal>
  </div>
}
