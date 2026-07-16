import { Button, Modal } from 'antd'
import { useState } from 'react'
import LayoutResizeControls from '../LayoutResizeControls'

export default function LayoutPanel({ regions, capabilities, onResize, sections }) {
  const [guide, setGuide] = useState(false)
  return <div className="space-y-4"><Button onClick={() => setGuide(true)}>Xem hướng dẫn tùy chỉnh bố cục</Button><div className="space-y-2">{regions.map((region) => <div key={region.id} className="rounded-lg border border-slate-200 bg-slate-50 p-3"><div className="mb-2 flex justify-between text-xs font-bold uppercase"><span>{region.id}</span><span>{region.width_percent}%</span></div><div className="space-y-1">{region.section_instance_ids.map((id) => <div key={id} className="rounded bg-white px-2 py-1 text-sm shadow-sm">{sections.find(({ section }) => section.instance_id === id)?.section.title || id}</div>)}</div></div>)}</div><LayoutResizeControls regions={regions} capabilities={capabilities} onResize={onResize} /><Modal open={guide} footer={null} onCancel={() => setGuide(false)} title="Hướng dẫn tùy chỉnh bố cục"><p className="font-semibold">Với tính năng Tùy chỉnh bố cục, bạn có thể:</p><ol className="mt-3 list-decimal space-y-2 pl-5"><li>Điều chỉnh độ rộng một cột trong CV</li><li>Di chuyển vị trí một mục</li><li>Thêm một mục mới vào CV</li></ol></Modal></div>
}
