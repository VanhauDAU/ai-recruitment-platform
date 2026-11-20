import { ArrowDownOutlined, ArrowUpOutlined, DeleteOutlined, EditOutlined, HolderOutlined } from '@ant-design/icons'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Button, Space, Switch, Tag, Tooltip } from 'antd'
import { BANNER_KIND_LABELS, bannerTheme } from '@/entities/content/banner'
import { m } from '@/shared/config/i18n'
import { formatDateTime } from '@/shared/lib/date-time'
import { SCHEDULE_TAGS } from '../model/banner-form'

function Thumbnail({ banner }) {
  const image = banner.image_url || banner.company?.cover_image_url
  if (image) return <img src={image} alt="" loading="lazy" className="h-full w-full object-cover" />
  return <span className={`block h-full w-full bg-gradient-to-br ${bannerTheme(banner.theme).gradient}`} />
}

function scheduleText(banner) {
  if (!banner.starts_at && !banner.ends_at) return m.admin_banner_schedule_always()
  return `${banner.starts_at ? formatDateTime(banner.starts_at) : '…'} → ${banner.ends_at ? formatDateTime(banner.ends_at) : '…'}`
}

export default function BannerRow({ banner, index, total, busy, onEdit, onDelete, onMove, onToggle }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: banner.id })
  const state = SCHEDULE_TAGS[banner.schedule_state] || SCHEDULE_TAGS.off
  const name = banner.title || banner.company?.trade_name || banner.company?.company_name || '—'
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`flex flex-wrap items-center gap-3 rounded-lg border border-slate-200 bg-white p-2 sm:flex-nowrap ${isDragging ? 'z-10 opacity-60 shadow-lg' : ''}`}
    >
      <Tooltip title={m.admin_banner_drag()}>
        <Button type="text" size="small" icon={<HolderOutlined />} aria-label={m.admin_banner_drag_item({ name })} className="cursor-grab" {...attributes} {...listeners} />
      </Tooltip>
      <span className="h-10 w-24 shrink-0 overflow-hidden rounded-md bg-slate-100 sm:h-12 sm:w-32"><Thumbnail banner={banner} /></span>
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium text-slate-900">{name}</p>
        <p className="flex flex-wrap items-center gap-1 text-xs text-slate-500">
          <Tag className="!mr-0">{BANNER_KIND_LABELS[banner.kind]?.() || banner.kind}</Tag>
          <Tag color={state.color} className="!mr-0">{state.label()}</Tag>
          <span>{scheduleText(banner)}</span>
        </p>
      </div>
      <Space size={4} className="ml-auto">
        <Switch size="small" checked={banner.is_active} disabled={busy} aria-label={m.admin_banner_toggle({ name })} onChange={(active) => onToggle(banner, active)} />
        <Space.Compact>
          <Button size="small" icon={<ArrowUpOutlined />} aria-label={m.admin_banner_move_up({ name })} disabled={busy || index === 0} onClick={() => onMove(index, -1)} />
          <Button size="small" icon={<ArrowDownOutlined />} aria-label={m.admin_banner_move_down({ name })} disabled={busy || index === total - 1} onClick={() => onMove(index, 1)} />
        </Space.Compact>
        <Button size="small" icon={<EditOutlined />} aria-label={m.admin_banner_edit_item({ name })} onClick={() => onEdit(banner)} />
        <Button size="small" danger icon={<DeleteOutlined />} aria-label={m.admin_banner_delete_item({ name })} onClick={() => onDelete(banner)} />
      </Space>
    </li>
  )
}
