import { ArrowDownOutlined, ArrowUpOutlined } from '@ant-design/icons'
import { Button, Checkbox, Select, Tag } from 'antd'
import { useState } from 'react'
import { SECTION_REGISTRY, getSectionDisplayName } from '@/entities/cv'
import { DEFAULT_SECTION_KEYS } from '../model/catalog'

// Mục do vị trí quyết định (tên, liên hệ, ảnh luôn có; thông tin riêng tự thêm).
const CONFIGURABLE = Object.values(SECTION_REGISTRY).filter((definition) => !definition.personalInfoBacked && !definition.positionBacked && definition.key !== 'custom').map((definition) => definition.key)

// Chưa chỉnh thì hiện đúng bộ mặc định đang áp dụng, để admin thấy trạng thái thật.
function initialRows(preset) {
  const chosen = preset.length ? preset.filter((entry) => entry.enabled !== false).map((entry) => entry.section_key) : DEFAULT_SECTION_KEYS
  const ticked = chosen.filter((key) => CONFIGURABLE.includes(key))
  return [...ticked.map((key) => ({ key, enabled: true })), ...CONFIGURABLE.filter((key) => !ticked.includes(key)).map((key) => ({ key, enabled: false }))]
}

// Mục nào xuất hiện trong CV dựng sẵn và theo thứ tự nào; kỹ năng thường gặp.
export default function SectionPresetEditor({ profile, canManage, saving, onSave }) {
  const customized = (profile.section_preset || []).length > 0
  const [rows, setRows] = useState(() => initialRows(profile.section_preset || []))
  const [keywords, setKeywords] = useState(profile.keywords || [])
  const move = (index, offset) => {
    const next = [...rows]
    const [row] = next.splice(index, 1)
    next.splice(index + offset, 0, row)
    setRows(next)
  }
  const chosen = rows.filter((row) => row.enabled)
  return <div className="space-y-4">
    <div>
      <p className="mb-2 flex flex-wrap items-center gap-2 text-sm font-semibold">Mục xuất hiện trong CV <Tag color={customized ? 'blue' : 'default'} className="!mr-0">{customized ? 'Đã chỉnh riêng cho vị trí này' : 'Đang dùng mặc định'}</Tag></p>
      <ol className="space-y-1">{rows.map((row, index) => <li key={row.key} className={`flex items-center gap-2 rounded-lg border px-3 py-1.5 ${row.enabled ? 'border-emerald-200 bg-emerald-50/50' : 'border-slate-200'}`}>
        <Checkbox checked={row.enabled} disabled={!canManage} onChange={(event) => setRows(rows.map((item) => (item.key === row.key ? { ...item, enabled: event.target.checked } : item)))}>{getSectionDisplayName(row.key, 'vi-VN')}</Checkbox>
        {row.enabled && <span className="text-xs text-slate-400">thứ {chosen.indexOf(row) + 1}</span>}
        <span className="ml-auto flex gap-1"><Button size="small" type="text" icon={<ArrowUpOutlined />} aria-label={`Đưa ${getSectionDisplayName(row.key, 'vi-VN')} lên`} disabled={!canManage || index === 0} onClick={() => move(index, -1)} /><Button size="small" type="text" icon={<ArrowDownOutlined />} aria-label={`Đưa ${getSectionDisplayName(row.key, 'vi-VN')} xuống`} disabled={!canManage || index === rows.length - 1} onClick={() => move(index, 1)} /></span>
      </li>)}</ol>
      <p className="mt-2 text-xs text-slate-500">Mục được tick mà nội dung gợi ý chưa có sẽ hiện trống để ứng viên tự điền. Mục "Thông tin chuyên môn" (tab Thông tin riêng) tự đứng sau Kỹ năng.</p>
    </div>
    <label className="block text-sm font-semibold">Kỹ năng thường gặp của vị trí
      <Select mode="tags" className="mt-1 w-full" aria-label="Kỹ năng thường gặp" disabled={!canManage} value={keywords} onChange={setKeywords} tokenSeparators={[',']} maxCount={30} placeholder="Gõ rồi Enter, ví dụ: Python, Đàm phán" />
      <span className="mt-1 block text-xs font-normal text-slate-500">AI dùng danh sách này khi viết nội dung gợi ý cho vị trí.</span>
    </label>
    {canManage && <div className="flex flex-wrap gap-2">
      <Button type="primary" loading={saving} disabled={chosen.length === 0} onClick={() => onSave({ section_preset: chosen.map((row) => ({ section_key: row.key, enabled: true })), keywords })}>Lưu</Button>
      {customized && <Button disabled={saving} onClick={() => onSave({ section_preset: [], keywords })}>Về mặc định</Button>}
    </div>}
  </div>
}
