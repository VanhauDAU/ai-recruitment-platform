import { Input } from 'antd'

export default function SkillsForm({ value, onChange }) {
  return (
    <section aria-labelledby="skills-title" className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 id="skills-title" className="text-lg font-bold text-slate-900">Kỹ năng</h2>
      <label className="mt-4 block"><span className="mb-1 block text-sm font-medium text-slate-700">Các kỹ năng (ngăn cách bởi dấu phẩy)</span><Input aria-label="Các kỹ năng" value={value} onChange={(event) => onChange(event.target.value)} placeholder="React, Django, Giao tiếp" /></label>
    </section>
  )
}
