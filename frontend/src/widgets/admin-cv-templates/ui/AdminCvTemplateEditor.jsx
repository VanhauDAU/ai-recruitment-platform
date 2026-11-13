import { ArrowLeftOutlined, CheckOutlined, HistoryOutlined, LoadingOutlined, RocketOutlined } from '@ant-design/icons'
import { useIsMutating, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Alert, Badge, Button, Drawer, Segmented, Skeleton, Table, Tag } from 'antd'
import { useState } from 'react'
import { Link, useParams } from 'react-router'
import { useAdminAccess } from '@/entities/admin-access'
import { RENDERER_CONTRACTS } from '@/entities/cv'
import { adminCvTemplates, configureAdminTemplateVersion, createAdminTemplateVersion, getAdminCvTemplate, getAdminTemplateChecklist, publishAdminTemplateVersion, setAdminTemplateColors } from '@/entities/cv-template'
import { useSession } from '@/entities/session'
import { getApiErrorMessage } from '@/shared/api/error-mapper'
import { adminPath } from '@/shared/config/portals'
import { message } from '@/shared/lib/toast'
import { AdminPanel } from '@/shared/ui/admin'
import { STATUS_TAGS, draftVersion, failingChecks, publishedVersion, replaceVersion } from '../model/templates'
import InfoCard from './editor/InfoCard'
import PublishModal from './editor/PublishModal'
import SectionsCard from './editor/SectionsCard'
import StyleCard from './editor/StyleCard'
import TemplatePreview from './editor/TemplatePreview'
import LayoutPicker from './LayoutPicker'

const VERSION_STATUS = { draft: ['gold', 'Nháp'], published: ['green', 'Đang dùng'], retired: ['default', 'Đã thay'] }

function SaveState({ publicId }) {
  const saving = useIsMutating({ mutationKey: ['admin-cv-template-save', publicId] })
  return <span className="hidden items-center gap-1 text-xs text-slate-500 sm:flex" aria-live="polite">{saving ? <><LoadingOutlined />Đang lưu…</> : <><CheckOutlined className="!text-emerald-500" />Đã lưu tự động</>}</span>
}

function VersionHistory({ versions }) {
  return <Table size="small" rowKey="id" pagination={false} dataSource={versions} scroll={{ x: 460 }} columns={[
    { title: 'Phiên bản', dataIndex: 'version_number', render: (number, row) => <span className="flex items-center gap-2">v{number}<Tag color={VERSION_STATUS[row.version_status]?.[0]} className="!mr-0">{VERSION_STATUS[row.version_status]?.[1] || row.version_status}</Tag></span> },
    { title: 'Bố cục', dataIndex: 'renderer_key', render: (key) => RENDERER_CONTRACTS[key]?.label || key },
    { title: 'Xuất bản', dataIndex: 'published_at', render: (value, row) => (value ? <span className="text-xs">{new Date(value).toLocaleString('vi-VN')}{row.published_by_name && <span className="block text-slate-500">{row.published_by_name}</span>}</span> : '—') },
  ]} />
}

// Trang chỉnh sửa một mẫu: thiết lập bên trái, xem trước bên phải, mọi thay đổi tự
// lưu. Mẫu đang hiển thị được sửa trên bản nháp (tạo tự động ở thay đổi đầu tiên);
// ứng viên chỉ thấy thay đổi sau khi xuất bản.
export default function AdminCvTemplateEditor() {
  const { publicId } = useParams()
  const queryClient = useQueryClient()
  const { user } = useSession()
  const access = useAdminAccess(user)
  const can = { manage: access.has('cv_template.manage'), publish: access.has('cv_template.publish') }
  const [pane, setPane] = useState('settings')
  const [historyOpen, setHistoryOpen] = useState(false)
  const [publishOpen, setPublishOpen] = useState(false)
  const queryKey = ['admin-cv-template', publicId]
  const { data: template, isLoading, isError } = useQuery({ queryKey, queryFn: () => getAdminCvTemplate(publicId) })
  const draft = draftVersion(template)
  const working = draft || publishedVersion(template)
  const checklist = useQuery({ queryKey: ['admin-cv-checklist', publicId, draft?.id], queryFn: () => getAdminTemplateChecklist(publicId, draft.id), enabled: Boolean(draft) })

  const save = useMutation({
    mutationKey: ['admin-cv-template-save', publicId],
    scope: { id: `admin-cv-template-${publicId}` },
    mutationFn: async ({ kind, payload }) => {
      if (kind === 'info') return { template: await adminCvTemplates.update(publicId, payload) }
      if (kind === 'colors') return { template: await setAdminTemplateColors(publicId, payload.colorIds, payload.defaultId) }
      const current = draftVersion(queryClient.getQueryData(queryKey)) || await createAdminTemplateVersion(publicId, payload.renderer_key ? { renderer_key: payload.renderer_key } : {})
      return { version: await configureAdminTemplateVersion(publicId, current.id, payload) }
    },
    onSuccess: ({ template: next, version }) => {
      queryClient.setQueryData(queryKey, (current) => next || replaceVersion(current, version))
      queryClient.invalidateQueries({ queryKey: ['admin-cv-templates'] })
      queryClient.invalidateQueries({ queryKey: ['admin-cv-checklist', publicId] })
    },
    onError: (error) => {
      message.error(getApiErrorMessage(error, 'Chưa lưu được thay đổi.'))
      queryClient.invalidateQueries({ queryKey })
    },
  })
  const publish = useMutation({
    mutationFn: () => publishAdminTemplateVersion(publicId, draft.id),
    onSuccess: () => {
      setPublishOpen(false)
      queryClient.invalidateQueries({ queryKey })
      queryClient.invalidateQueries({ queryKey: ['admin-cv-templates'] })
      message.success('Đã xuất bản. Ảnh mẫu theo từng màu đang được tạo.')
    },
    onError: (error) => message.error(getApiErrorMessage(error, 'Chưa xuất bản được; kiểm tra các mục còn thiếu.')),
  })

  if (isLoading) return <Skeleton active paragraph={{ rows: 10 }} />
  if (isError) return <Alert type="error" showIcon message="Không tải được mẫu CV." />

  const status = STATUS_TAGS[template.lifecycle_status]
  const pending = failingChecks(checklist.data).length
  const config = (payload) => save.mutate({ kind: 'config', payload })
  return <div className="space-y-4">
    <header className="flex flex-wrap items-center gap-x-3 gap-y-2">
      <Link to={adminPath('/cv/templates')}><Button size="small" type="text" icon={<ArrowLeftOutlined />}>Mẫu CV</Button></Link>
      <div className="order-3 flex min-w-0 basis-full flex-wrap items-center gap-2 sm:order-2 sm:basis-0 sm:flex-1">
        <h1 className="min-w-0 truncate text-lg font-bold text-slate-900 sm:text-xl">{template.name}</h1>
        {status && <Tag color={status[0]} className="!mr-0">{status[1]}</Tag>}
        {draft && template.current_published_version_id && <Tag color="gold" className="!mr-0">Có thay đổi chưa xuất bản</Tag>}
      </div>
      <div className="order-2 ml-auto flex items-center gap-2 sm:order-3">
        <SaveState publicId={publicId} />
        <Button icon={<HistoryOutlined />} onClick={() => setHistoryOpen(true)} aria-label="Lịch sử phiên bản"><span className="hidden md:inline">Lịch sử</span></Button>
        {draft && <Badge count={pending} size="small" offset={[-4, 4]}><Button type="primary" icon={<RocketOutlined />} onClick={() => setPublishOpen(true)}>Xuất bản</Button></Badge>}
      </div>
    </header>
    {!draft && working && <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600 ring-1 ring-slate-200">Mẫu đang hiển thị trên kho mẫu. Sửa bố cục, chữ hoặc các mục sẽ tạo bản nháp; ứng viên chỉ thấy thay đổi sau khi bạn xuất bản.</p>}
    {working && <div className="lg:hidden"><Segmented block value={pane} onChange={setPane} options={[{ value: 'settings', label: 'Thiết lập' }, { value: 'preview', label: 'Xem trước' }]} /></div>}
    <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[minmax(0,24rem)_minmax(0,1fr)] xl:grid-cols-[minmax(0,27rem)_minmax(0,1fr)]">
      <div className={`min-w-0 space-y-4 ${pane === 'preview' ? 'hidden lg:block' : ''}`}>
        <InfoCard template={template} canManage={can.manage} onSave={(payload) => save.mutate({ kind: 'info', payload })} />
        <AdminPanel title="Bố cục" description="Số cột và chỗ đặt tên, ảnh, liên hệ. Chấm tròn = có ảnh đại diện.">
          <LayoutPicker value={(save.isPending && save.variables?.payload?.renderer_key) || working?.renderer_key} disabled={!can.manage} onChange={(renderer_key) => renderer_key !== working?.renderer_key && config({ renderer_key })} />
        </AdminPanel>
        {working && <>
          <StyleCard template={template} version={working} canManage={can.manage} onSaveColors={(payload) => save.mutate({ kind: 'colors', payload })} onSaveStyle={(style) => config({ style })} />
          <SectionsCard key={`${working.id}-${working.renderer_key}`} version={working} canManage={can.manage} onSave={config} />
        </>}
      </div>
      <div className={`min-w-0 lg:sticky lg:top-[calc(var(--admin-topbar-height,72px)_+_1rem)] ${pane === 'settings' ? 'hidden lg:block' : ''}`}>
        {working
          ? <TemplatePreview template={template} version={working} />
          : <div className="rounded-[13px] border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">Chọn bố cục để bắt đầu; bản xem trước hiện ở đây.</div>}
      </div>
    </div>
    <PublishModal open={publishOpen} onClose={() => setPublishOpen(false)} template={template} draft={draft} checklist={checklist.data} canPublish={can.publish} publishing={publish.isPending} onPublish={() => publish.mutate()} />
    <Drawer open={historyOpen} onClose={() => setHistoryOpen(false)} title={`Lịch sử phiên bản (${template.versions.length})`} size="min(560px, 100vw)">
      <VersionHistory versions={template.versions} />
    </Drawer>
  </div>
}
