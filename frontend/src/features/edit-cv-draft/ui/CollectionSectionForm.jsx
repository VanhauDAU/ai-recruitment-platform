import { ArrowDownOutlined, ArrowUpOutlined, DeleteOutlined, PlusOutlined } from '@ant-design/icons'
import { Button, Input } from 'antd'
import { richText, richTextToText } from '@/entities/cv'

const FIELD_SETS = {
  experience: [['role', 'Chức danh'], ['company', 'Công ty']],
  education: [['degree', 'Bằng cấp / chuyên ngành'], ['institution', 'Trường / tổ chức']],
  skills: [['name', 'Kỹ năng'], ['level', 'Mức độ']],
  projects: [['name', 'Tên dự án'], ['role', 'Vai trò']],
  certifications: [['name', 'Chứng chỉ'], ['issuer', 'Đơn vị cấp']],
}

function ItemEditor({ section, item, position, onChange, onMove, onRemove }) {
  const fields = FIELD_SETS[section.section_key] || [['name', 'Tên mục'], ['value', 'Nội dung ngắn']]
  const usesDates = ['experience', 'education'].includes(section.section_key)
  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
      <div className="mb-3 flex items-center justify-between gap-2"><span className="font-semibold text-slate-700">Mục {position + 1}</span><div className="flex gap-1"><Button size="small" aria-label={`Di chuyển item ${item.item_id} lên`} icon={<ArrowUpOutlined />} disabled={position === 0} onClick={() => onMove(item.item_id, -1)} /><Button size="small" aria-label={`Di chuyển item ${item.item_id} xuống`} icon={<ArrowDownOutlined />} disabled={position === section.items.length - 1} onClick={() => onMove(item.item_id, 1)} /><Button size="small" danger aria-label={`Xóa item ${item.item_id}`} icon={<DeleteOutlined />} onClick={() => onRemove(item.item_id)} /></div></div>
      <div className="grid gap-3 sm:grid-cols-2">{fields.map(([field, label]) => <label key={field}><span className="mb-1 block text-sm">{label}</span><Input aria-label={`${label} ${item.item_id}`} value={item[field] || ''} onChange={(event) => onChange(item.item_id, { [field]: event.target.value })} /></label>)}{usesDates && <><label><span className="mb-1 block text-sm">Từ tháng</span><Input type="month" aria-label={`Từ tháng ${item.item_id}`} value={item.start_date || ''} onChange={(event) => onChange(item.item_id, { start_date: event.target.value || null })} /></label><label><span className="mb-1 block text-sm">Đến tháng</span><Input type="month" aria-label={`Đến tháng ${item.item_id}`} value={item.end_date || ''} onChange={(event) => onChange(item.item_id, { end_date: event.target.value || null })} /></label></>}</div>
      {section.section_key !== 'skills' && <label className="mt-3 block"><span className="mb-1 block text-sm">Mô tả</span><Input.TextArea aria-label={`Mô tả ${item.item_id}`} rows={3} value={richTextToText(item.description)} onChange={(event) => onChange(item.item_id, { description: richText(event.target.value) })} /></label>}
    </div>
  )
}

export default function CollectionSectionForm({ section, onAdd, onChange, onMove, onRemove }) {
  return (
    <section aria-labelledby={`section-${section.instance_id}`} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3"><div><h2 id={`section-${section.instance_id}`} className="text-lg font-bold text-slate-900">{section.title}</h2>{!section.enabled && <p className="text-sm text-amber-700">Section đang tắt và sẽ không xuất hiện trong preview.</p>}</div><Button size="small" aria-label={`Thêm item ${section.instance_id}`} icon={<PlusOutlined />} onClick={onAdd}>Thêm item</Button></div>
      <div className="mt-4 space-y-4">{section.items.map((item, position) => <ItemEditor key={item.item_id} section={section} item={item} position={position} onChange={onChange} onMove={onMove} onRemove={onRemove} />)}{section.items.length === 0 && <p className="rounded-lg border border-dashed border-slate-300 p-3 text-sm text-slate-500">Chưa có item. Bật section hoặc thêm item để tiếp tục.</p>}</div>
    </section>
  )
}
