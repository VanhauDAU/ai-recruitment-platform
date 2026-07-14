import { DeleteOutlined, PlusOutlined } from '@ant-design/icons'
import { Button, Input } from 'antd'
import { richTextToText } from '@/entities/cv'

export default function ExperienceForm({ items, onChange, onAdd, onRemove }) {
  return (
    <section aria-labelledby="experience-title" className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3"><h2 id="experience-title" className="text-lg font-bold text-slate-900">Kinh nghiệm</h2><Button size="small" icon={<PlusOutlined />} onClick={onAdd}>Thêm kinh nghiệm</Button></div>
      <div className="mt-4 space-y-4">
        {items.map((item, index) => <div key={item.item_id} className="rounded-xl border border-slate-100 bg-slate-50 p-4"><div className="mb-3 flex items-center justify-between"><span className="font-semibold text-slate-700">Kinh nghiệm {index + 1}</span>{items.length > 1 && <Button type="text" danger aria-label={`Xóa kinh nghiệm ${index + 1}`} icon={<DeleteOutlined />} onClick={() => onRemove(item.item_id)} />}</div><div className="grid gap-3 sm:grid-cols-2"><label><span className="mb-1 block text-sm">Chức danh</span><Input aria-label={`Chức danh ${index + 1}`} value={item.role || ''} onChange={(event) => onChange(item.item_id, { role: event.target.value })} /></label><label><span className="mb-1 block text-sm">Công ty</span><Input aria-label={`Công ty ${index + 1}`} value={item.company || ''} onChange={(event) => onChange(item.item_id, { company: event.target.value })} /></label><label><span className="mb-1 block text-sm">Từ tháng</span><Input type="month" aria-label={`Từ tháng ${index + 1}`} value={item.start_date || ''} onChange={(event) => onChange(item.item_id, { start_date: event.target.value || null })} /></label><label><span className="mb-1 block text-sm">Đến tháng</span><Input type="month" aria-label={`Đến tháng ${index + 1}`} value={item.end_date || ''} onChange={(event) => onChange(item.item_id, { end_date: event.target.value || null })} /></label></div><label className="mt-3 block"><span className="mb-1 block text-sm">Mô tả</span><Input.TextArea aria-label={`Mô tả kinh nghiệm ${index + 1}`} rows={3} value={richTextToText(item.description)} onChange={(event) => onChange(item.item_id, { description: { format: 'rich_text_v1', content: event.target.value ? [{ type: 'paragraph', text: event.target.value }] : [] } })} /></label></div>)}
      </div>
    </section>
  )
}
