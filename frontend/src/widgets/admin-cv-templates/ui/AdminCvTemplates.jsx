import { CopyOutlined, EyeInvisibleOutlined, EyeOutlined, HolderOutlined, PlusOutlined, SearchOutlined } from '@ant-design/icons'
import { DndContext, PointerSensor, closestCenter, useSensor, useSensors } from '@dnd-kit/core'
import { SortableContext, arrayMove, rectSortingStrategy, useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Alert, Button, Empty, Input, Segmented, Select, Skeleton, Tag, Tooltip } from 'antd'
import { useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { useAdminAccess } from '@/entities/admin-access'
import { RENDERER_CONTRACTS } from '@/entities/cv'
import { adminCvTemplates, duplicateAdminTemplate, reorderAdminTemplates, setAdminTemplateVisibility } from '@/entities/cv-template'
import { useSession } from '@/entities/session'
import { getApiErrorMessage } from '@/shared/api/error-mapper'
import { adminPath } from '@/shared/config/portals'
import { message } from '@/shared/lib/toast'
import { STATUS_TAGS, currentRendererKey, draftVersion } from '../model/templates'
import CreateTemplateModal from './CreateTemplateModal'
import LayoutSchematic from './LayoutSchematic'

const STATUS_FILTERS = [{ value: 'all', label: 'Tất cả' }, ...Object.entries(STATUS_TAGS).map(([value, [, label]]) => ({ value, label }))]

function TemplateCard({ template, sortable, can, onAction }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: template.public_id, disabled: !sortable })
  const status = STATUS_TAGS[template.lifecycle_status] || STATUS_TAGS.draft
  const rendererKey = currentRendererKey(template)
  const href = adminPath(`/cv/templates/${template.public_id}`)
  const published = template.lifecycle_status === 'published'
  return <article ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }} className={`group relative flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white transition hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow-md ${isDragging ? 'z-10 opacity-60 shadow-lg' : ''}`}>
    <Link to={href} tabIndex={-1} aria-hidden="true" className="block !bg-slate-50 px-6 pb-0 pt-4">
      {template.thumbnail_url
        ? <img src={template.thumbnail_url} alt="" loading="lazy" width={210} height={297} className="mx-auto aspect-[210/297] w-full rounded-t border border-b-0 border-slate-200 object-cover object-top shadow-sm" />
        : <LayoutSchematic rendererKey={rendererKey} className="mx-auto w-full rounded-b-none border-b-0" />}
    </Link>
    <Tag color={status[0]} className="!absolute !right-2 !top-2 !mr-0 shadow-sm">{status[1]}</Tag>
    <div className="flex flex-1 flex-col gap-1 border-t border-slate-100 p-3">
      <Link to={href} className="truncate font-semibold !text-slate-900 hover:!text-emerald-700">{template.name}</Link>
      <p className="truncate text-xs text-slate-500">{RENDERER_CONTRACTS[rendererKey]?.label || 'Chưa chọn bố cục'} · {template.usage_count} lượt dùng</p>
      <div className="mt-1 flex items-center gap-1">
        <span className="flex flex-1 -space-x-1">{template.colors.slice(0, 6).map((color) => <span key={color.public_id} title={color.name} className="h-4 w-4 rounded-full border-2 border-white" style={{ background: color.hex_code }} />)}</span>
        {draftVersion(template) && published && <Tooltip title="Có thay đổi chưa xuất bản"><span className="h-2 w-2 rounded-full bg-amber-400" /></Tooltip>}
        {can.manage && <Tooltip title="Nhân bản"><Button size="small" type="text" icon={<CopyOutlined />} aria-label={`Nhân bản ${template.name}`} onClick={() => onAction('duplicate', template)} /></Tooltip>}
        {can.publish && template.current_published_version_id && <Tooltip title={published ? 'Ẩn khỏi kho mẫu' : 'Hiện lại trên kho mẫu'}><Button size="small" type="text" icon={published ? <EyeInvisibleOutlined /> : <EyeOutlined />} aria-label={`${published ? 'Ẩn' : 'Hiện'} ${template.name}`} onClick={() => onAction('visibility', template)} /></Tooltip>}
        {sortable && <Tooltip title="Kéo để đổi thứ tự"><Button size="small" type="text" icon={<HolderOutlined />} aria-label={`Kéo ${template.name}`} {...attributes} {...listeners} className="cursor-grab" /></Tooltip>}
      </div>
    </div>
  </article>
}

export default function AdminCvTemplates() {
  const { user } = useSession()
  const access = useAdminAccess(user)
  const can = { manage: access.has('cv_template.manage'), publish: access.has('cv_template.publish') }
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [params, setParams] = useSearchParams()
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('all')
  const [layout, setLayout] = useState()
  const creating = can.manage && params.get('new') === '1'
  const setCreating = (open) => setParams(open ? { new: '1' } : {}, { replace: true })
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))
  const { data = [], isLoading, isError } = useQuery({ queryKey: ['admin-cv-templates'], queryFn: () => adminCvTemplates.list() })
  const filtered = useMemo(() => data.filter((template) => (!search || template.name.toLocaleLowerCase('vi').includes(search.toLocaleLowerCase('vi')))
    && (status === 'all' || template.lifecycle_status === status) && (!layout || currentRendererKey(template) === layout)), [data, search, status, layout])
  const act = useMutation({
    mutationFn: ({ action, template, order }) => (action === 'duplicate' ? duplicateAdminTemplate(template.public_id) : action === 'reorder' ? reorderAdminTemplates(order) : setAdminTemplateVisibility(template.public_id, template.lifecycle_status !== 'published')),
    onMutate: ({ action, order }) => {
      if (action === 'reorder') queryClient.setQueryData(['admin-cv-templates'], (current) => order.map((id) => current.find((template) => template.public_id === id)))
    },
    onSuccess: (result, { action }) => {
      queryClient.invalidateQueries({ queryKey: ['admin-cv-templates'] })
      if (action === 'duplicate') navigate(adminPath(`/cv/templates/${result.public_id}`))
    },
    onError: (error) => {
      queryClient.invalidateQueries({ queryKey: ['admin-cv-templates'] })
      message.error(getApiErrorMessage(error, 'Không thể thực hiện thao tác.'))
    },
  })
  const sortable = can.manage && filtered.length === data.length
  const onDragEnd = ({ active, over }) => {
    if (!over || active.id === over.id) return
    const ids = data.map((template) => template.public_id)
    act.mutate({ action: 'reorder', order: arrayMove(ids, ids.indexOf(active.id), ids.indexOf(over.id)) })
  }
  return <div className="space-y-3">
    <div className="flex flex-wrap items-center gap-2">
      <Input allowClear prefix={<SearchOutlined className="text-slate-400" />} placeholder="Tìm mẫu" onChange={(event) => setSearch(event.target.value)} className="!w-full sm:!w-56" />
      <Segmented value={status} onChange={setStatus} options={STATUS_FILTERS} className="max-w-full overflow-x-auto" />
      <Select allowClear placeholder="Mọi bố cục" value={layout} onChange={setLayout} options={Object.values(RENDERER_CONTRACTS).map((contract) => ({ value: contract.key, label: contract.label }))} className="w-full sm:w-52" />
      {can.manage && <Button type="primary" icon={<PlusOutlined />} className="sm:ml-auto" onClick={() => setCreating(true)}>Tạo mẫu</Button>}
    </div>
    <p className="text-xs text-slate-500">{sortable ? 'Kéo biểu tượng ⋮⋮ để đổi thứ tự trên kho mẫu.' : can.manage && data.length > 0 ? 'Đang lọc: bỏ bộ lọc để kéo thả sắp xếp.' : null} Sửa mẫu đang hiển thị sẽ tạo bản nháp; CV đã tạo không bị ảnh hưởng.</p>
    {isLoading && <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">{Array.from({ length: 5 }, (_, index) => <Skeleton.Node key={index} active className="!aspect-[3/4] !h-auto !w-full" />)}</div>}
    {isError && <Alert type="error" showIcon message="Không tải được danh sách mẫu." />}
    {!isLoading && data.length === 0 && <Empty description="Chưa có mẫu CV nào.">{can.manage && <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreating(true)}>Tạo mẫu đầu tiên</Button>}</Empty>}
    {!isLoading && data.length > 0 && filtered.length === 0 && <Empty description="Không có mẫu nào khớp bộ lọc." />}
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      <SortableContext items={filtered.map((template) => template.public_id)} strategy={rectSortingStrategy}>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">{filtered.map((template) => <TemplateCard key={template.public_id} template={template} sortable={sortable} can={can} onAction={(action, row) => act.mutate({ action, template: row })} />)}</div>
      </SortableContext>
    </DndContext>
    <CreateTemplateModal open={creating} onClose={() => setCreating(false)} />
  </div>
}
