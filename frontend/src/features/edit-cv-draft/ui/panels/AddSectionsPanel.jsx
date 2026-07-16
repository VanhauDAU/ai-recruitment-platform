import { PlusOutlined } from '@ant-design/icons'
import { Button, Input } from 'antd'
import { useState } from 'react'
import { getSectionDisplayName } from '@/entities/cv'
import { getRegionLabel } from '../../model/region-labels'

export default function AddSectionsPanel({ locale, availableKeys, sections, onAdd, onAddCustom, onLocate }) {
  const [customTitle, setCustomTitle] = useState('')
  const positions = new Map()
  return <div className="space-y-6">
    <section>
      <h3 className="font-bold">Mục chưa sử dụng</h3>
      <p className="mb-3 text-xs text-slate-500">Bấm Thêm để chèn mục sau phần đang chọn; bạn vẫn có thể kéo sang vị trí khác.</p>
      <div className="grid grid-cols-2 gap-2">{availableKeys.filter((key) => key !== 'custom').map((key) => <button key={key} type="button" onClick={() => onAdd(key)} className="min-h-16 cursor-pointer rounded-lg border border-dashed border-emerald-300 bg-emerald-50 p-2 text-left text-sm font-semibold text-emerald-800 transition hover:border-emerald-500 hover:bg-emerald-100">+ {getSectionDisplayName(key, locale)}</button>)}</div>
      {availableKeys.filter((key) => key !== 'custom').length === 0 && <p className="rounded-lg bg-slate-50 p-3 text-sm text-slate-500">Bạn đã dùng tất cả mục tiêu chuẩn.</p>}
    </section>
    <section>
      <h3 className="font-bold">Mục tùy chỉnh</h3>
      <p className="mb-3 text-xs text-slate-500">Tạo một mục riêng cho thông tin chưa có trong danh sách tiêu chuẩn.</p>
      <div className="flex gap-2"><Input aria-label="Tiêu đề mục tùy chỉnh" value={customTitle} placeholder="Ví dụ: Thành tựu nổi bật" onChange={(event) => setCustomTitle(event.target.value)} onPressEnter={() => {
        if (!customTitle.trim()) return
        onAddCustom(customTitle.trim())
        setCustomTitle('')
      }} /><Button aria-label="Thêm mục tùy chỉnh" type="primary" icon={<PlusOutlined />} disabled={!customTitle.trim()} onClick={() => {
        onAddCustom(customTitle.trim())
        setCustomTitle('')
      }}>Thêm</Button></div>
    </section>
    <section>
      <h3 className="font-bold">Mục đang dùng</h3>
      <p className="mb-3 text-xs text-slate-500">Đi tới và mở biểu mẫu chỉnh sửa của mục tương ứng.</p>
      <div className="space-y-2">{sections.map(({ section, regionId }) => {
        const position = (positions.get(regionId) || 0) + 1
        positions.set(regionId, position)
        return <button key={section.instance_id} type="button" onClick={() => onLocate(section.instance_id)} className="flex w-full cursor-pointer items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white p-2 text-left text-sm transition hover:border-emerald-300 hover:bg-emerald-50"><span className="min-w-0 truncate font-semibold">{section.title || getSectionDisplayName(section.section_key, locale)}</span><span className="shrink-0 text-[10px] uppercase text-slate-400">{regionId ? getRegionLabel(regionId) : 'ẩn'} · {position}</span></button>
      })}</div>
    </section>
  </div>
}
