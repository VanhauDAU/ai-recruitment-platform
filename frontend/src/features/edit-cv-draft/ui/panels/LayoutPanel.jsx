import { HolderOutlined } from '@ant-design/icons'
import { Button, Modal, Slider } from 'antd'
import { useDroppable } from '@dnd-kit/core'
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useState } from 'react'
import { getSectionDisplayName } from '@/entities/cv'
import { getRegionLabel } from '../../model/region-labels'
import LayoutResizeControls from '../LayoutResizeControls'

function MiniSection({ instanceId, title, onLocate }) {
  const sortable = useSortable({ id: `mini-section:${instanceId}` })
  return <button ref={sortable.setNodeRef} {...sortable.attributes} {...sortable.listeners} type="button" aria-label={`Khối bố cục ${title}`} onClick={() => onLocate?.(instanceId)} style={{ transform: CSS.Transform.toString(sortable.transform), transition: sortable.transition }} className={`flex w-full min-w-0 cursor-grab items-center justify-between gap-1 rounded-md border bg-white px-1.5 py-1.5 text-left text-[11px] font-semibold text-slate-700 shadow-sm transition hover:border-emerald-400 hover:bg-emerald-50 ${sortable.isDragging ? 'opacity-40' : ''} ${sortable.isOver && !sortable.isDragging ? 'border-emerald-500 ring-1 ring-emerald-400' : 'border-slate-200'}`}>
    <span className="truncate">{title}</span>
    <HolderOutlined className="shrink-0 text-slate-300" aria-hidden="true" />
  </button>
}

function MiniRegion({ region, titles, onLocate }) {
  const droppable = useDroppable({ id: `mini-region:${region.id}` })
  const instanceIds = region.section_instance_ids || []
  return <div ref={droppable.setNodeRef} style={{ width: `${region.width_percent}%` }} className={`min-w-0 rounded-lg border border-dashed p-1 transition ${droppable.isOver ? 'border-emerald-500 bg-emerald-50' : 'border-slate-200 bg-slate-50'}`}>
    <p className="mb-1 truncate px-0.5 text-[10px] font-bold uppercase text-slate-400">{getRegionLabel(region.id)} · {region.width_percent}%</p>
    <SortableContext items={instanceIds.map((instanceId) => `mini-section:${instanceId}`)} strategy={verticalListSortingStrategy}>
      <div className="min-h-8 space-y-1">{instanceIds.map((instanceId) => <MiniSection key={instanceId} instanceId={instanceId} title={titles.get(instanceId) || instanceId} onLocate={onLocate} />)}</div>
    </SortableContext>
  </div>
}

export default function LayoutPanel({ regions, capabilities, onResize, sections, onLocate, pageMargin, onPageMarginChange }) {
  const [guide, setGuide] = useState(false)
  const titles = new Map(sections.map(({ section }) => [section.instance_id, section.title || getSectionDisplayName(section.section_key)]))
  const rows = [...regions.reduce((grouped, region) => {
    const row = region.row ?? 0
    grouped.set(row, [...(grouped.get(row) || []), region])
    return grouped
  }, new Map())].sort(([a], [b]) => a - b)
  return <div className="space-y-4">
    <Button onClick={() => setGuide(true)}>Xem hướng dẫn tùy chỉnh bố cục</Button>
    {onPageMarginChange && <section className="rounded-xl border border-slate-200 bg-slate-50 p-3"><div className="flex items-center justify-between gap-3"><div><p className="text-sm font-bold text-slate-700">Lề trang</p><p className="text-xs text-slate-500">Giảm lề để tận dụng diện tích A4.</p></div><span className="text-sm font-bold text-slate-700">{pageMargin} mm</span></div><Slider aria-label="Lề trang CV" min={5} max={16} value={pageMargin} onChange={onPageMarginChange} /></section>}
    <section aria-label="Sơ đồ bố cục CV">
      <p className="mb-2 text-xs text-slate-500">Sơ đồ thu nhỏ của CV: kéo khối để đổi vị trí hoặc chuyển cột, bấm để đi tới mục trên CV.</p>
      <div className="space-y-1 rounded-xl border border-slate-200 bg-white p-1.5 shadow-inner">{rows.map(([row, rowRegions]) => <div key={row} className="flex gap-1">{rowRegions.map((region) => <MiniRegion key={region.id} region={region} titles={titles} onLocate={onLocate} />)}</div>)}</div>
    </section>
    <LayoutResizeControls regions={regions} capabilities={capabilities} onResize={onResize} />
    <Modal open={guide} footer={null} onCancel={() => setGuide(false)} title="Hướng dẫn tùy chỉnh bố cục"><p className="font-semibold">Với tính năng Tùy chỉnh bố cục, bạn có thể:</p><ol className="mt-3 list-decimal space-y-2 pl-5"><li>Kéo khối trong sơ đồ (hoặc kéo mục ngay trên CV) để đổi vị trí, chuyển cột</li><li>Điều chỉnh độ rộng một cột trong CV</li><li>Điều chỉnh lề A4 để tối ưu không gian</li></ol></Modal>
  </div>
}
