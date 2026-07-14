import { ArrowDownOutlined, ArrowUpOutlined, DeleteOutlined, PlusOutlined } from '@ant-design/icons'
import { Button, Input, Select, Switch } from 'antd'
import { useState } from 'react'
import { canDragSection, getSectionDefinition } from '@/entities/cv'

const SECTION_DRAG_TYPE = 'application/x-cv-section'

function draggedSectionId(event) {
  return event.dataTransfer.getData(SECTION_DRAG_TYPE)
}

function SectionRow({ section, region, position, regionSections, regions, capabilities, onDelete, onToggle, onRename, onMove, onDrop, onRegionChange }) {
  const canDrag = canDragSection(section, capabilities)
  const allowDrop = (event) => {
    if (capabilities.sectionDrag && draggedSectionId(event)) event.preventDefault()
  }
  return (
    <div draggable={canDrag} onDragStart={(event) => event.dataTransfer.setData(SECTION_DRAG_TYPE, section.instance_id)} onDragOver={allowDrop} onDrop={(event) => { event.preventDefault(); event.stopPropagation(); const source = draggedSectionId(event); if (source) onDrop(source, region.id, position) }} className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-100 bg-slate-50 p-3" data-section-instance-id={section.instance_id}>
      <span aria-hidden="true" className="cursor-grab text-slate-400">⠿</span><Switch aria-label={`Bật ${section.title}`} checked={section.enabled} onChange={(enabled) => onToggle(section.instance_id, enabled)} /><Input aria-label={`Tiêu đề ${section.instance_id}`} value={section.title} onChange={(event) => onRename(section.instance_id, event.target.value)} className="min-w-40 flex-1" /><span className="text-xs text-slate-500">{region.id}</span>
      {regions.length > 1 && capabilities.crossRegionDrag && <Select aria-label={`Chuyển ${section.instance_id} đến vùng`} value={region.id} options={regions.map((item) => ({ value: item.id, label: item.id }))} onChange={(targetRegionId) => onRegionChange(section.instance_id, targetRegionId)} className="min-w-28" />}
      <Button size="small" aria-label={`Di chuyển ${section.instance_id} lên`} icon={<ArrowUpOutlined />} disabled={position === 0} onClick={() => onMove(section.instance_id, -1)} /><Button size="small" aria-label={`Di chuyển ${section.instance_id} xuống`} icon={<ArrowDownOutlined />} disabled={position === regionSections.length - 1} onClick={() => onMove(section.instance_id, 1)} /><Button size="small" danger aria-label={`Xóa ${section.instance_id}`} icon={<DeleteOutlined />} onClick={() => onDelete(section.instance_id)} />
    </div>
  )
}

export default function SectionManager({ regions, sections, capabilities, availableSectionKeys, onAdd, onDelete, onToggle, onRename, onMove, onDrop, onRegionChange }) {
  const [newSectionKey, setNewSectionKey] = useState()
  const options = availableSectionKeys.map((key) => ({ value: key, label: getSectionDefinition(key).displayName }))
  const byRegion = new Map(regions.map((region) => [region.id, sections.filter((item) => item.regionId === region.id)]))
  const dropSection = (instanceId, targetRegionId, targetIndex) => {
    const source = sections.find((item) => item.section.instance_id === instanceId)
    if (source?.regionId && source.regionId !== targetRegionId && !capabilities.crossRegionDrag) return
    onDrop(instanceId, targetRegionId, targetIndex)
  }
  return (
    <section aria-labelledby="section-manager-title" className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 id="section-manager-title" className="text-lg font-bold text-slate-900">Quản lý section</h2><p className="mt-1 text-sm text-slate-500">Kéo thả hoặc dùng Move Up/Down; layout giữ thứ tự và vùng, không dùng chỉ số mảng làm identity.</p></div><div className="flex gap-2"><Select aria-label="Thêm section" placeholder="Chọn section" value={newSectionKey} options={options} onChange={setNewSectionKey} className="min-w-44" /><Button aria-label="Xác nhận thêm section" icon={<PlusOutlined />} disabled={!newSectionKey} onClick={() => { onAdd(newSectionKey); setNewSectionKey(undefined) }}>Thêm</Button></div></div>
      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        {regions.map((region) => {
          const regionSections = byRegion.get(region.id) || []
          const allowDrop = (event) => { if (capabilities.sectionDrag && draggedSectionId(event)) event.preventDefault() }
          return <div key={region.id} aria-label={`Vùng layout ${region.id}`} onDragOver={allowDrop} onDrop={(event) => { event.preventDefault(); const source = draggedSectionId(event); if (source) dropSection(source, region.id, regionSections.length) }} className="min-h-20 rounded-xl border border-dashed border-slate-300 p-3"><p className="mb-2 text-sm font-bold uppercase tracking-wide text-slate-600">{region.id} · {region.width_percent}%</p><div className="space-y-2">{regionSections.map(({ section }, position) => <SectionRow key={section.instance_id} section={section} region={region} position={position} regionSections={regionSections} regions={regions} capabilities={capabilities} onDelete={onDelete} onToggle={onToggle} onRename={onRename} onMove={onMove} onDrop={dropSection} onRegionChange={onRegionChange} />)}{regionSections.length === 0 && <p className="text-sm text-slate-400">Thả section vào vùng này.</p>}</div></div>
        })}
      </div>
    </section>
  )
}
