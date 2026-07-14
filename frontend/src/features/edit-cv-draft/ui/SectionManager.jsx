import { ArrowDownOutlined, ArrowUpOutlined, DeleteOutlined, PlusOutlined } from '@ant-design/icons'
import { Button, Input, Select, Switch } from 'antd'
import { useState } from 'react'
import { getSectionDefinition } from '@/entities/cv'

export default function SectionManager({ sections, availableSectionKeys, onAdd, onDelete, onToggle, onRename, onMove }) {
  const [newSectionKey, setNewSectionKey] = useState()
  const options = availableSectionKeys.map((key) => ({ value: key, label: getSectionDefinition(key).displayName }))
  return (
    <section aria-labelledby="section-manager-title" className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 id="section-manager-title" className="text-lg font-bold text-slate-900">Quản lý section</h2><p className="mt-1 text-sm text-slate-500">Thứ tự section được lưu trong layout, không dùng chỉ số mảng làm identity.</p></div><div className="flex gap-2"><Select aria-label="Thêm section" placeholder="Chọn section" value={newSectionKey} options={options} onChange={setNewSectionKey} className="min-w-44" /><Button aria-label="Xác nhận thêm section" icon={<PlusOutlined />} disabled={!newSectionKey} onClick={() => { onAdd(newSectionKey); setNewSectionKey(undefined) }}>Thêm</Button></div></div>
      <div className="mt-4 space-y-2">
        {sections.map(({ section, regionId }) => {
          const regionSections = regionId ? sections.filter((candidate) => candidate.regionId === regionId) : []
          const position = regionSections.findIndex((candidate) => candidate.section.instance_id === section.instance_id)
          return <div key={section.instance_id} className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-100 bg-slate-50 p-3"><Switch aria-label={`Bật ${section.title}`} checked={section.enabled} onChange={(enabled) => onToggle(section.instance_id, enabled)} /><Input aria-label={`Tiêu đề ${section.instance_id}`} value={section.title} onChange={(event) => onRename(section.instance_id, event.target.value)} className="min-w-48 flex-1" /><span className="text-xs text-slate-500">{regionId || 'chưa gán vùng'}</span><Button size="small" aria-label={`Di chuyển ${section.instance_id} lên`} icon={<ArrowUpOutlined />} disabled={position <= 0} onClick={() => onMove(section.instance_id, -1)} /><Button size="small" aria-label={`Di chuyển ${section.instance_id} xuống`} icon={<ArrowDownOutlined />} disabled={position < 0 || position === regionSections.length - 1} onClick={() => onMove(section.instance_id, 1)} /><Button size="small" danger aria-label={`Xóa ${section.instance_id}`} icon={<DeleteOutlined />} onClick={() => onDelete(section.instance_id)} /></div>
        })}
      </div>
    </section>
  )
}
