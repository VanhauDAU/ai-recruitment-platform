import { EyeOutlined, LockOutlined, UnlockOutlined } from '@ant-design/icons'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Alert, Button, Checkbox, Drawer, Input, Modal, Select, Table, Tag } from 'antd'
import { useState } from 'react'
import { useSearchParams } from 'react-router'
import { useAdminAccess } from '@/entities/admin-access'
import { FittedCvPreview } from '@/entities/cv'
import { getAdminUserCvs, lockAdminUserCv, unlockAdminUserCv, viewAdminUserCvContent } from '@/entities/cv-template'
import { useSession } from '@/entities/session'
import { getApiErrorMessage } from '@/shared/api/error-mapper'
import { message } from '@/shared/lib/toast'
import { AdminPanel } from '@/shared/ui/admin'

const SOURCES = { builder: 'Tạo trên web', uploaded: 'Tải lên', imported: 'Trích xuất' }
const STATUSES = { draft: 'Nháp', published: 'Đã lưu', archived: 'Lưu trữ' }
const formatDate = (value) => (value ? new Date(value).toLocaleDateString('vi-VN') : '—')

// Hộp nhập lý do dùng chung cho xem nội dung và khóa CV: lý do được ghi nhật ký.
function ReasonModal({ action, onCancel, onSubmit, loading }) {
  const [reason, setReason] = useState('')
  if (!action) return null
  return <Modal open title={action.title} okText={action.okText} cancelText="Hủy" confirmLoading={loading} okButtonProps={{ disabled: reason.trim().length < 10, danger: action.danger }} onCancel={() => { setReason(''); onCancel() }} onOk={() => onSubmit(reason.trim()).then(() => setReason(''))}>
    <p className="mb-2 text-sm text-slate-600">{action.hint}</p>
    <Input.TextArea aria-label="Lý do" rows={3} maxLength={255} showCount value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Ví dụ: Xử lý khiếu nại số 4521 (ít nhất 10 ký tự)" />
  </Modal>
}

export default function AdminCvUserCvs() {
  const { user } = useSession()
  const access = useAdminAccess(user)
  const canViewContent = access.has('cv_user.view_content')
  const queryClient = useQueryClient()
  const [params, setParams] = useSearchParams()
  const [action, setAction] = useState(null)
  const [content, setContent] = useState(null)
  const filters = Object.fromEntries(['q', 'source', 'status', 'import_failed', 'locked', 'page'].map((key) => [key, params.get(key) || undefined]))
  const setFilter = (key, value) => {
    const next = new URLSearchParams(params)
    if (value) next.set(key, value)
    else next.delete(key)
    if (key !== 'page') next.delete('page')
    setParams(next, { replace: true })
  }
  const { data, isLoading, isError } = useQuery({ queryKey: ['admin-user-cvs', filters], queryFn: () => getAdminUserCvs(filters), placeholderData: keepPreviousData })
  const submit = useMutation({
    mutationFn: ({ kind, row, reason }) => (kind === 'content' ? viewAdminUserCvContent(row.public_id, reason) : kind === 'lock' ? lockAdminUserCv(row.public_id, reason) : unlockAdminUserCv(row.public_id)),
    onSuccess: (result, { kind, row }) => {
      if (kind === 'content') setContent({ ...result, public_id: row.public_id })
      else {
        queryClient.invalidateQueries({ queryKey: ['admin-user-cvs'] })
        message.success(kind === 'lock' ? 'Đã khóa chia sẻ công khai của CV.' : 'Đã mở khóa CV.')
      }
      setAction(null)
    },
    onError: (error) => message.error(getApiErrorMessage(error, 'Không thể thực hiện thao tác.')),
  })
  const ask = (kind, row) => setAction(kind === 'content'
    ? { kind, row, title: `Xem nội dung CV ${row.public_id}`, okText: 'Xem nội dung', hint: 'Nội dung CV là dữ liệu cá nhân của ứng viên. Lần xem này được ghi nhật ký kèm lý do.' }
    : { kind, row, title: `Khóa CV ${row.public_id}`, okText: 'Khóa CV', danger: true, hint: 'Thu hồi mọi link chia sẻ công khai và chặn tạo link mới. Ứng viên vẫn sửa, tải PDF và ứng tuyển bằng CV.' })

  const columns = [
    { title: 'Mã CV', dataIndex: 'public_id', render: (id, row) => <span className="flex flex-wrap items-center gap-1 font-mono text-xs">{id}{row.is_locked && <Tag color="red" icon={<LockOutlined />}>Đã khóa</Tag>}</span> },
    { title: 'Mã ứng viên', dataIndex: 'candidate_public_id', render: (id) => <span className="font-mono text-xs">{id}</span>, responsive: ['md'] },
    { title: 'Mẫu', dataIndex: 'template_name', render: (name) => name || '—', responsive: ['lg'] },
    { title: 'Nguồn', dataIndex: 'source', render: (source, row) => <span className="flex flex-wrap gap-1"><Tag>{SOURCES[source] || source}</Tag>{row.import_status === 'failed' && <Tag color="red">Lỗi: {row.import_failure_code || 'không rõ'}</Tag>}</span> },
    { title: 'Ngôn ngữ', dataIndex: 'language', responsive: ['lg'] },
    { title: 'Trạng thái', dataIndex: 'lifecycle_status', render: (status) => STATUSES[status] || status, responsive: ['md'] },
    { title: 'Ứng tuyển', dataIndex: 'application_count', align: 'right', responsive: ['md'] },
    { title: 'Cập nhật', dataIndex: 'updated_at', render: formatDate, responsive: ['lg'] },
    ...(canViewContent ? [{ title: '', width: 96, render: (_, row) => <span className="flex gap-1">
      <Button size="small" type="text" icon={<EyeOutlined />} aria-label={`Xem nội dung ${row.public_id}`} onClick={() => ask('content', row)} />
      {row.is_locked
        ? <Button size="small" type="text" icon={<UnlockOutlined />} aria-label={`Mở khóa ${row.public_id}`} onClick={() => submit.mutate({ kind: 'unlock', row })} />
        : <Button size="small" type="text" danger icon={<LockOutlined />} aria-label={`Khóa ${row.public_id}`} onClick={() => ask('lock', row)} />}
    </span> }] : []),
  ]
  return <div className="space-y-3">
    <Alert type="info" showIcon message="Chỉ hiện thông tin quản lý. Xem nội dung CV cần quyền riêng và lý do; mỗi lần xem được ghi nhật ký." />
    <AdminPanel padded={false} title="CV ứng viên" extra={<div className="flex flex-wrap items-center gap-2">
      <Input.Search allowClear size="small" placeholder="Mã CV hoặc mã ứng viên" defaultValue={filters.q} onSearch={(value) => setFilter('q', value.trim())} style={{ width: 230 }} />
      <Select allowClear size="small" placeholder="Nguồn" value={filters.source} onChange={(value) => setFilter('source', value)} options={Object.entries(SOURCES).map(([value, label]) => ({ value, label }))} style={{ width: 140 }} />
      <Checkbox checked={filters.import_failed === 'true'} onChange={(event) => setFilter('import_failed', event.target.checked ? 'true' : '')}>Import lỗi</Checkbox>
      <Checkbox checked={filters.locked === 'true'} onChange={(event) => setFilter('locked', event.target.checked ? 'true' : '')}>Đã khóa</Checkbox>
    </div>}>
      {isError ? <Alert className="m-4" type="error" showIcon message="Không tải được danh sách CV." /> : <Table size="small" rowKey="public_id" loading={isLoading} dataSource={data?.results || []} columns={columns} scroll={{ x: 640 }} pagination={{ current: Number(filters.page || 1), total: data?.count || 0, pageSize: 20, showSizeChanger: false, onChange: (page) => setFilter('page', page > 1 ? String(page) : '') }} />}
    </AdminPanel>
    <ReasonModal action={action} loading={submit.isPending} onCancel={() => setAction(null)} onSubmit={(reason) => submit.mutateAsync({ kind: action.kind, row: action.row, reason })} />
    <Drawer open={Boolean(content)} width={Math.min(globalThis.innerWidth || 900, 900)} title={content && `Nội dung CV ${content.public_id}`} onClose={() => setContent(null)}>
      {content && <FittedCvPreview document={content.document} rendererKey={content.renderer_key} />}
    </Drawer>
  </div>
}
