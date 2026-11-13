import { CheckCircleFilled, EditOutlined, RobotOutlined, RollbackOutlined } from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Button, Popconfirm, Skeleton, Tag, Tooltip } from 'antd'
import { useState } from 'react'
import { adminCvSamples, archiveAdminCvSample, generateAdminCvSamples, getCvPositionPreview, publishAdminCvSample } from '@/entities/cv-template'
import { getApiErrorMessage } from '@/shared/api/error-mapper'
import { message } from '@/shared/lib/toast'
import { BANDS, LOCALES } from '../model/catalog'
import SampleEditorDrawer from './SampleEditorDrawer'

const WAITING = { in_review: ['purple', 'AI viết, chờ duyệt'], draft: ['gold', 'Bản nháp'] }

// Bản nháp mới khởi đầu từ nội dung ứng viên đang nhận cho ô này (riêng hoặc chung),
// không mang danh tính.
async function starterContent(positionPublicId, locale, band) {
  const preview = await getCvPositionPreview(positionPublicId, locale, undefined, { experienceBand: band })
  const content = structuredClone(preview.content_json)
  content.personal_info = { full_name: '', headline: content.personal_info?.headline || '', email: '', phone: '', address: '', avatar_asset_id: null, links: [] }
  return content
}

// Một ô = nội dung ứng viên nhận với (mức kinh nghiệm, ngôn ngữ) đó: bản riêng
// đang dùng, hoặc bản chung; kèm bản nháp/bản AI đang chờ.
function Cell({ locale, samples, can, busy, onAction }) {
  const live = samples.find((sample) => sample.status === 'published')
  const waiting = samples.filter((sample) => sample.status !== 'published')
  return <div className={`flex min-w-0 flex-col gap-2 rounded-lg border p-2.5 ${live ? 'border-emerald-200 bg-emerald-50/40' : 'border-slate-200 bg-white'}`}>
    <div className="flex items-center justify-between gap-2">
      <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">{locale.label}</span>
      {live ? <Tag color="green" icon={<CheckCircleFilled />} className="!mr-0">Bản riêng</Tag> : <Tag className="!mr-0">Bản chung</Tag>}
    </div>
    {waiting.map((sample) => <div key={sample.public_id} className="flex flex-wrap items-center gap-x-1 rounded-md bg-white px-2 py-1 ring-1 ring-slate-200">
      <Tag color={WAITING[sample.status]?.[0]} className="!mr-auto">{WAITING[sample.status]?.[1]}</Tag>
      <Button size="small" type="link" className="!px-1" onClick={() => onAction('open', sample)}>Xem</Button>
      {can.publish && <Button size="small" type="link" className="!px-1" onClick={() => onAction('publish', sample)}>Dùng</Button>}
      {can.publish && <Button size="small" type="link" danger className="!px-1" onClick={() => onAction('archive', sample)}>Bỏ</Button>}
    </div>)}
    <div className="mt-auto flex flex-wrap items-center gap-1">
      {live && <Button size="small" icon={<EditOutlined />} onClick={() => onAction('open', live)}>{can.manage ? 'Xem / sửa' : 'Xem'}</Button>}
      {live && can.publish && <Popconfirm title="Quay về bản chung?" description="Ứng viên sẽ nhận nội dung chung cho ô này." okText="Quay về bản chung" cancelText="Hủy" onConfirm={() => onAction('archive', live)}><Tooltip title="Quay về bản chung"><Button size="small" type="text" icon={<RollbackOutlined />} aria-label="Quay về bản chung" /></Tooltip></Popconfirm>}
      {!live && waiting.length === 0 && can.manage && <Button size="small" icon={<EditOutlined />} loading={busy} onClick={() => onAction('create')}>Tự viết</Button>}
      {!live && waiting.length === 0 && can.generate && <Button size="small" icon={<RobotOutlined />} loading={busy} onClick={() => onAction('generate')}>Nhờ AI</Button>}
    </div>
  </div>
}

const AI_POLL_MS = 60_000

// Lưới mức kinh nghiệm × ngôn ngữ của một vị trí.
export default function SampleContentGrid({ profile, canManage, canPublish, canGenerate, onChanged }) {
  const queryClient = useQueryClient()
  const [editing, setEditing] = useState(null)
  const [pollUntil, setPollUntil] = useState(0)
  const queryKey = ['admin-cv-samples', 'position', profile.position_public_id]
  // Sau khi nhờ AI viết, tự tải lại một lúc để bản chờ duyệt hiện ra.
  const { data = [], isLoading } = useQuery({ queryKey, queryFn: () => adminCvSamples.list({ position: profile.position_public_id }), refetchInterval: () => (Date.now() < pollUntil ? 4000 : false) })
  const act = useMutation({
    mutationFn: async ({ action, sample, locale, band }) => {
      if (action === 'publish') return publishAdminCvSample(sample.public_id)
      if (action === 'archive') return archiveAdminCvSample(sample.public_id)
      if (action === 'save') return adminCvSamples.update(sample.public_id, { title: sample.title, content_json: sample.content_json })
      if (action === 'generate') return generateAdminCvSamples({ position_public_ids: [profile.position_public_id], locales: [locale], experience_bands: [band] })
      return adminCvSamples.create({ position_public_id: profile.position_public_id, locale, experience_band: band, title: `${profile.position_name} · ${BANDS.find((item) => item.value === band).label}`, content_json: await starterContent(profile.position_public_id, locale, band), schema_version: 1 })
    },
    onSuccess: (result, { action }) => {
      queryClient.invalidateQueries({ queryKey: ['admin-cv-samples'] })
      queryClient.invalidateQueries({ queryKey: ['admin-cv-coverage'] })
      onChanged?.()
      setEditing(action === 'create' ? result : null)
      if (action === 'generate') setPollUntil(Date.now() + AI_POLL_MS)
      const notice = { publish: 'Đã dùng bản này cho ứng viên.', archive: 'Đã bỏ.', save: 'Đã lưu.', generate: 'AI đang viết (khoảng 10 giây); bản chờ duyệt sẽ hiện ở ô này.' }[action]
      if (notice) message.success(notice)
    },
    onError: (error) => message.error(getApiErrorMessage(error, 'Không thể thực hiện thao tác.')),
  })
  if (isLoading) return <Skeleton active paragraph={{ rows: 6 }} />
  const visible = data.filter((sample) => sample.status !== 'archived')
  const can = { manage: canManage, publish: canPublish, generate: canGenerate }
  return <div className="space-y-3">
    <p className="text-xs text-slate-500"><strong>Bản chung</strong> dùng cho mọi vị trí (tự thay tên vị trí); <strong>bản riêng</strong> viết đúng cho nghề này. Bản mới chỉ đến tay ứng viên khi bấm "Dùng".</p>
    <div className="space-y-3">{BANDS.map((band) => <div key={band.value} className="grid grid-cols-1 gap-2 sm:grid-cols-[8.5rem_minmax(0,1fr)_minmax(0,1fr)]">
      <div className="sm:pt-2"><p className="text-sm font-semibold text-slate-800">{band.label}</p><p className="text-xs text-slate-500">{band.who}</p></div>
      {LOCALES.map((locale) => <Cell key={locale.value} locale={locale} samples={visible.filter((sample) => sample.locale === locale.value && sample.experience_band === band.value)} can={can}
        busy={act.isPending && act.variables?.locale === locale.value && act.variables?.band === band.value}
        onAction={(action, sample) => (action === 'open' ? setEditing(sample) : act.mutate({ action, sample, locale: locale.value, band: band.value }))} />)}
    </div>)}</div>
    {editing && <SampleEditorDrawer key={editing.public_id} sample={editing} saving={act.isPending} readOnly={!canManage || (editing.status === 'published' && !canPublish)} onClose={() => setEditing(null)} onSave={(sample) => act.mutate({ action: 'save', sample })} />}
  </div>
}
