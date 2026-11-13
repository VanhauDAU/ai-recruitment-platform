import { CheckOutlined, CloseOutlined, EditOutlined, ReloadOutlined } from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Button, Empty, Skeleton, Tag } from 'antd'
import { useState } from 'react'
import { FittedCvPreview } from '@/entities/cv'
import { adminCvSamples, archiveAdminCvSample, generateAdminCvSamples, publishAdminCvSample } from '@/entities/cv-template'
import { getApiErrorMessage } from '@/shared/api/error-mapper'
import { message } from '@/shared/lib/toast'
import { AdminPanel } from '@/shared/ui/admin'
import { bandLabel, localeLabel, sampleDocument } from '../model/catalog'
import SampleEditorDrawer from './SampleEditorDrawer'

// Bản AI chờ duyệt: đọc bản xem trước rồi Duyệt (đến tay ứng viên) / Sửa / Viết lại / Bỏ.
export default function ReviewQueue({ canPublish, canManage, canGenerate }) {
  const queryClient = useQueryClient()
  const [selectedId, setSelectedId] = useState(null)
  const [editing, setEditing] = useState(null)
  const { data = [], isLoading } = useQuery({ queryKey: ['admin-cv-samples', 'in_review'], queryFn: () => adminCvSamples.list({ status: 'in_review' }) })
  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['admin-cv-samples'] })
    queryClient.invalidateQueries({ queryKey: ['admin-cv-coverage'] })
  }
  const act = useMutation({
    mutationFn: async ({ action, sample }) => {
      if (action === 'approve') return publishAdminCvSample(sample.public_id)
      if (action === 'reject') return archiveAdminCvSample(sample.public_id)
      if (action === 'save') return adminCvSamples.update(sample.public_id, { title: sample.title, content_json: sample.content_json })
      await generateAdminCvSamples({ position_public_ids: [sample.position_public_id], locales: [sample.locale], experience_bands: [sample.experience_band] })
      return archiveAdminCvSample(sample.public_id)
    },
    onSuccess: (_, { action }) => {
      refresh()
      setEditing(null)
      message.success({ approve: 'Đã duyệt. Ứng viên sẽ nhận bản này.', reject: 'Đã bỏ.', save: 'Đã lưu thay đổi.', regenerate: 'AI đang viết lại; bản mới sẽ vào danh sách này.' }[action])
    },
    onError: (error) => message.error(getApiErrorMessage(error, 'Không thể thực hiện thao tác.')),
  })
  if (isLoading) return <Skeleton active paragraph={{ rows: 6 }} />
  if (data.length === 0) return <Empty description="Không có bản nào chờ duyệt. Bản AI viết xong sẽ hiện ở đây." />
  const selected = data.find((sample) => sample.public_id === selectedId) || data[0]
  return <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
    <AdminPanel padded={false} title={`Chờ duyệt (${data.length})`} description="Bản AI viết chưa đến tay ứng viên cho tới khi bạn duyệt.">
      <ul className="divide-y divide-slate-100">{data.map((sample) => <li key={sample.public_id}><button type="button" onClick={() => setSelectedId(sample.public_id)} className={`w-full px-4 py-3 text-left text-sm hover:bg-slate-50 ${sample.public_id === selected.public_id ? 'bg-emerald-50' : ''}`}><p className="font-semibold">{sample.position_name}</p><p className="mt-1 flex flex-wrap gap-1"><Tag>{localeLabel(sample.locale)}</Tag><Tag>Kinh nghiệm {bandLabel(sample.experience_band).toLowerCase()}</Tag></p></button></li>)}</ul>
    </AdminPanel>
    <AdminPanel title={selected.title} extra={<div className="flex flex-wrap gap-2">
      {canPublish && <Button size="small" type="primary" icon={<CheckOutlined />} loading={act.isPending} onClick={() => act.mutate({ action: 'approve', sample: selected })}>Duyệt & dùng</Button>}
      {canManage && <Button size="small" icon={<EditOutlined />} onClick={() => setEditing(selected)}>Sửa</Button>}
      {canGenerate && <Button size="small" icon={<ReloadOutlined />} onClick={() => act.mutate({ action: 'regenerate', sample: selected })}>Viết lại</Button>}
      {canPublish && <Button size="small" danger icon={<CloseOutlined />} onClick={() => act.mutate({ action: 'reject', sample: selected })}>Bỏ</Button>}
    </div>}>
      <div className="max-h-[75vh] overflow-y-auto bg-slate-100 p-3 [scrollbar-gutter:stable]"><FittedCvPreview document={sampleDocument(selected.content_json)} rendererKey="single_column_v1" /></div>
    </AdminPanel>
    {editing && <SampleEditorDrawer key={editing.public_id} sample={editing} saving={act.isPending} onClose={() => setEditing(null)} onSave={(sample) => act.mutate({ action: 'save', sample })} />}
  </div>
}
