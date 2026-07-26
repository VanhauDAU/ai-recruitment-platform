import {
  DeleteOutlined,
  EditOutlined,
  PlusOutlined,
  SearchOutlined,
  SwapOutlined,
} from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Alert,
  Button,
  Card,
  Empty,
  Form,
  Input,
  Modal,
  Select,
  Space,
  Switch,
  Table,
  Tag,
} from 'antd'
import { useMemo, useState } from 'react'
import {
  adminBlogKeys,
  createAdminBlogTag,
  deleteAdminBlogTag,
  getAdminBlogTags,
  mergeAdminBlogTag,
  updateAdminBlogTag,
} from '@/entities/blog'
import { message } from '@/shared/lib/toast'
import { findSimilarTagGroups } from '../model/tag-groups'

function apiError(error, fallback) {
  const data = error.response?.data
  return data?.name?.[0] || data?.slug?.[0] || data?.detail || fallback
}

export default function BlogTagManagement({ canManage = false }) {
  const queryClient = useQueryClient()
  const [query, setQuery] = useState('')
  const [visibility, setVisibility] = useState('all')
  const [editing, setEditing] = useState(null)
  const [merging, setMerging] = useState(null)
  const [mergeTarget, setMergeTarget] = useState()
  const [form] = Form.useForm()
  const tagsQuery = useQuery({
    queryKey: adminBlogKeys.tags(),
    queryFn: ({ signal }) => getAdminBlogTags({}, { signal }),
  })
  const tags = useMemo(() => tagsQuery.data || [], [tagsQuery.data])
  const rows = useMemo(() => tags.filter((tag) => {
    const needle = query.trim().toLocaleLowerCase('vi-VN')
    const matchesQuery = !needle || `${tag.name} ${tag.slug}`.toLocaleLowerCase('vi-VN').includes(needle)
    const matchesVisibility = visibility === 'all' || (visibility === 'active' ? tag.is_active : !tag.is_active)
    return matchesQuery && matchesVisibility
  }), [query, tags, visibility])
  const similarGroups = useMemo(() => findSimilarTagGroups(tags), [tags])
  const refresh = () => queryClient.invalidateQueries({ queryKey: adminBlogKeys.root })

  const saveMutation = useMutation({
    mutationFn: (payload) => editing?.public_id
      ? updateAdminBlogTag(editing.public_id, payload)
      : createAdminBlogTag(payload),
    onSuccess: () => {
      message.success('Đã lưu thẻ.')
      setEditing(null)
      form.resetFields()
      refresh()
    },
    onError: (error) => message.error(apiError(error, 'Không thể lưu thẻ.')),
  })
  const visibilityMutation = useMutation({
    mutationFn: ({ tag, is_active }) => updateAdminBlogTag(tag.public_id, { is_active }),
    onSuccess: refresh,
    onError: (error) => message.error(apiError(error, 'Không thể đổi trạng thái thẻ.')),
  })
  const deleteMutation = useMutation({
    mutationFn: deleteAdminBlogTag,
    onSuccess: () => { message.success('Đã xóa thẻ không còn sử dụng.'); refresh() },
    onError: (error) => message.error(apiError(error, 'Không thể xóa thẻ đang được sử dụng.')),
  })
  const mergeMutation = useMutation({
    mutationFn: () => mergeAdminBlogTag(merging.public_id, mergeTarget),
    onSuccess: (target) => {
      message.success(`Đã gộp vào thẻ “${target.name}”.`)
      setMerging(null)
      setMergeTarget(undefined)
      refresh()
    },
    onError: (error) => message.error(apiError(error, 'Không thể gộp thẻ.')),
  })

  const openEditor = (tag = {}) => {
    if (!canManage) return
    setEditing(tag)
    form.resetFields()
    form.setFieldsValue({ name: tag.name, slug: tag.slug, is_active: tag.is_active ?? true })
  }
  const confirmDelete = (tag) => Modal.confirm({
    title: `Xóa thẻ “${tag.name}”?`,
    content: 'Chỉ thẻ chưa được bài viết hoặc bản sửa nào sử dụng mới có thể xóa.',
    okText: 'Xóa thẻ',
    okButtonProps: { danger: true },
    onOk: () => deleteMutation.mutateAsync(tag.public_id),
  })

  const columns = [
    { title: 'Tên thẻ', dataIndex: 'name', render: (name, tag) => <div><p className="font-semibold text-slate-800">{name}</p><p className="text-xs text-slate-400">/{tag.slug}</p></div> },
    { title: 'Số bài sử dụng', dataIndex: 'post_count', width: 150 },
    { title: 'Bản sửa', dataIndex: 'working_copy_count', width: 100 },
    { title: 'Trạng thái', width: 130, render: (_, tag) => <Space><Switch aria-label={`Hiển thị thẻ ${tag.name}`} checked={tag.is_active} disabled={!canManage} loading={visibilityMutation.isPending} onChange={(is_active) => visibilityMutation.mutate({ tag, is_active })} /><span>{tag.is_active ? 'Hiển thị' : 'Đã ẩn'}</span></Space> },
    { title: 'Thao tác', width: 250, render: (_, tag) => canManage ? <Space wrap><Button icon={<EditOutlined />} onClick={() => openEditor(tag)}>Sửa</Button><Button icon={<SwapOutlined />} onClick={() => { setMerging(tag); setMergeTarget(undefined) }}>Gộp</Button><Button danger icon={<DeleteOutlined />} disabled={tag.usage_count > 0} onClick={() => confirmDelete(tag)}>Xóa</Button></Space> : <span className="text-xs text-slate-400">Chỉ xem</span> },
  ]

  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div><h2 className="text-lg font-semibold text-slate-900">Quản lý thẻ bài viết</h2><p className="mt-1 text-sm text-slate-500">Chuẩn hóa, gộp và kiểm soát thẻ dùng trong Cẩm nang nghề nghiệp.</p></div>
        {canManage && <Button type="primary" icon={<PlusOutlined />} onClick={() => openEditor()}>Thêm thẻ</Button>}
      </div>

      {similarGroups.length > 0 && <Alert type="warning" showIcon title={`Phát hiện ${similarGroups.length} nhóm thẻ có thể trùng`} description={similarGroups.slice(0, 3).map((group) => group.map((tag) => tag.name).join(' ↔ ')).join('; ')} />}

      <Card>
        <div className="mb-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_220px]">
          <Input allowClear prefix={<SearchOutlined />} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tìm theo tên hoặc slug" />
          <Select value={visibility} onChange={setVisibility} options={[{ value: 'all', label: `Tất cả (${tags.length})` }, { value: 'active', label: `Đang hiển thị (${tags.filter((tag) => tag.is_active).length})` }, { value: 'hidden', label: `Đã ẩn (${tags.filter((tag) => !tag.is_active).length})` }]} />
        </div>
        <div className="hidden overflow-x-auto md:block"><Table rowKey="public_id" loading={tagsQuery.isLoading} dataSource={rows} columns={columns} pagination={{ pageSize: 20, showSizeChanger: false }} /></div>
        <div className="space-y-3 md:hidden">
          {rows.map((tag) => <Card key={tag.public_id} size="small"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="font-semibold text-slate-800">{tag.name}</p><p className="truncate text-xs text-slate-400">/{tag.slug}</p></div><Tag color={tag.is_active ? 'green' : 'default'}>{tag.is_active ? 'Hiển thị' : 'Đã ẩn'}</Tag></div><p className="mt-3 text-sm text-slate-500">{tag.post_count} bài viết · {tag.working_copy_count} bản sửa</p>{canManage && <Space wrap className="mt-3"><Button onClick={() => openEditor(tag)}>Sửa</Button><Button onClick={() => { setMerging(tag); setMergeTarget(undefined) }}>Gộp</Button><Button danger disabled={tag.usage_count > 0} onClick={() => confirmDelete(tag)}>Xóa</Button></Space>}</Card>)}
          {!tagsQuery.isLoading && rows.length === 0 && <Empty description="Không có thẻ phù hợp" />}
        </div>
      </Card>

      <Modal title={editing?.public_id ? 'Sửa thẻ' : 'Thêm thẻ'} open={Boolean(editing)} confirmLoading={saveMutation.isPending} onCancel={() => setEditing(null)} onOk={() => form.validateFields().then((payload) => saveMutation.mutate(payload))} okText="Lưu thẻ">
        <Form form={form} layout="vertical"><Form.Item name="name" label="Tên thẻ" rules={[{ required: true, whitespace: true, message: 'Nhập tên thẻ.' }]}><Input maxLength={100} /></Form.Item><Form.Item name="slug" label="Slug" tooltip="Có thể chỉnh tại trang quản trị; hệ thống tự tạo nếu để trống khi thêm mới."><Input maxLength={120} placeholder="Tự động nếu để trống" /></Form.Item><Form.Item name="is_active" label="Hiển thị" valuePropName="checked"><Switch /></Form.Item></Form>
      </Modal>

      <Modal title={`Gộp thẻ “${merging?.name || ''}”`} open={Boolean(merging)} confirmLoading={mergeMutation.isPending} okText="Gộp thẻ" okButtonProps={{ danger: true, disabled: !mergeTarget }} onCancel={() => setMerging(null)} onOk={() => mergeMutation.mutate()}>
        <Alert className="mb-4" type="info" showIcon message="Các bài viết sẽ được chuyển sang thẻ đích; thẻ nguồn sau đó bị xóa." />
        <label className="mb-2 block text-sm font-medium text-slate-700" htmlFor="merge-target">Thẻ đích</label>
        <Select id="merge-target" className="w-full" showSearch optionFilterProp="label" value={mergeTarget} onChange={setMergeTarget} placeholder="Chọn thẻ muốn giữ lại" options={tags.filter((tag) => tag.public_id !== merging?.public_id).map((tag) => ({ value: tag.public_id, label: `${tag.name} · ${tag.usage_count} lượt dùng` }))} />
      </Modal>
    </section>
  )
}
