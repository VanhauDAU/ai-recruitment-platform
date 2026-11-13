import { ArrowDownOutlined, ArrowUpOutlined, DownOutlined, SwapOutlined, UpOutlined } from '@ant-design/icons'
import { Button, Dropdown, Select, Slider } from 'antd'
import { useState } from 'react'
import { SECTION_REGISTRY, getRendererContract, getSectionDisplayName } from '@/entities/cv'
import { getRegionLabel } from '@/features/edit-cv-draft'
import { AdminPanel } from '@/shared/ui/admin'
import { SECTION_STATES, resizablePair, sectionFlags, sectionState } from '../../model/templates'

const IDENTITY = ['nameplate', 'contact']
const name = (key) => getSectionDisplayName(key, 'vi-VN')

// Mục nào nằm ở vùng nào, thứ tự, bắt buộc/bật sẵn/ẩn sẵn và độ rộng cột. Mẫu mới
// đã được xếp sẵn hợp lý nên phần này thu gọn mặc định. Mỗi thay đổi lưu ngay.
export default function SectionsCard({ version, canManage, onSave }) {
  const contract = getRendererContract(version.renderer_key)
  const [open, setOpen] = useState(false)
  const [rows, setRows] = useState(version.sections)
  const pair = resizablePair(contract)
  const widths = Object.fromEntries(version.default_layout_json.regions.map((region) => [region.id, region.width_percent]))
  const regionIds = contract.regions.map((region) => region.id)
  const update = (next) => {
    setRows(next)
    onSave({ sections: next })
  }
  const patch = (key, change) => update(rows.map((row) => (row.section_key === key ? { ...row, ...change } : row)))
  const move = (key, direction) => {
    const index = rows.findIndex((row) => row.section_key === key)
    let target = index + direction
    while (rows[target] && rows[target].region_key !== rows[index].region_key) target += direction
    if (!rows[target]) return
    const next = [...rows]
    ;[next[index], next[target]] = [next[target], next[index]]
    update(next)
  }
  const unused = Object.values(SECTION_REGISTRY).filter((definition) => definition.key !== 'custom' && !rows.some((row) => row.section_key === definition.key) && (definition.key !== 'avatar' || contract.avatar))

  return <AdminPanel title="Các mục trong CV" description="Đã xếp sẵn theo bố cục; ứng viên vẫn kéo thả lại được." extra={<Button size="small" type="text" onClick={() => setOpen(!open)} aria-expanded={open}>{open ? <>Thu gọn <UpOutlined /></> : <>Tùy chỉnh <DownOutlined /></>}</Button>} padded={open}>
    {open && <div className="space-y-4">
      {pair && <label className="block text-sm font-semibold text-slate-700">
        Độ rộng {getRegionLabel(pair[0].id).toLowerCase()}: {widths[pair[0].id]}%
        <Slider key={`${version.id}-${widths[pair[0].id]}`} min={contract.resize.min} max={contract.resize.max} disabled={!canManage} defaultValue={widths[pair[0].id]} tooltip={{ formatter: (value) => `${value}%` }} onChangeComplete={(value) => onSave({ widths: { [pair[0].id]: value, [pair[1].id]: 100 - value } })} />
      </label>}
      {regionIds.map((regionId) => <section key={regionId}>
        {regionIds.length > 1 && <h3 className="mb-1.5 text-xs font-bold uppercase tracking-wide text-slate-500">{getRegionLabel(regionId)}</h3>}
        <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
          {rows.filter((row) => row.region_key === regionId).map((row) => {
            const identity = IDENTITY.includes(row.section_key)
            const others = regionIds.filter((id) => id !== regionId)
            return <li key={row.section_key} className="flex items-center gap-1 px-2 py-1.5 text-sm">
              <span className={`min-w-0 flex-1 truncate ${sectionState(row) === 'off' ? 'text-slate-400' : 'font-medium text-slate-800'}`}>{name(row.section_key)}</span>
              <Select size="small" variant="borderless" aria-label={`Trạng thái ${name(row.section_key)}`} className="w-[6.5rem]" disabled={!canManage || identity} value={sectionState(row)} options={SECTION_STATES.map(({ value, label }) => ({ value, label }))} onChange={(state) => patch(row.section_key, sectionFlags(state))} popupMatchSelectWidth={false} />
              {others.length > 0 && <Dropdown disabled={!canManage} trigger={['click']} menu={{ items: others.map((id) => ({ key: id, label: `Chuyển sang ${getRegionLabel(id).toLowerCase()}` })), onClick: ({ key }) => patch(row.section_key, { region_key: key }) }}>
                <Button size="small" type="text" icon={<SwapOutlined />} aria-label={`Chuyển vùng ${name(row.section_key)}`} />
              </Dropdown>}
              <Button size="small" type="text" icon={<ArrowUpOutlined />} aria-label={`Đưa ${name(row.section_key)} lên`} disabled={!canManage} onClick={() => move(row.section_key, -1)} />
              <Button size="small" type="text" icon={<ArrowDownOutlined />} aria-label={`Đưa ${name(row.section_key)} xuống`} disabled={!canManage} onClick={() => move(row.section_key, 1)} />
            </li>
          })}
          {!rows.some((row) => row.region_key === regionId) && <li className="px-2 py-2 text-xs text-slate-400">Chưa có mục nào.</li>}
        </ul>
      </section>)}
      {canManage && unused.length > 0 && <Select aria-label="Thêm mục" placeholder="+ Thêm mục khác" value={null} className="w-full" onChange={(key) => update([...rows, { section_key: key, region_key: regionIds.at(-1), ...sectionFlags('on') }])} options={unused.map((definition) => ({ value: definition.key, label: name(definition.key) }))} />}
    </div>}
  </AdminPanel>
}
