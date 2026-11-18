import { Input } from 'antd'

export default function SummaryForm({ value, onChange }) {
  return (
    <section aria-labelledby="summary-title" className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 id="summary-title" className="text-lg font-bold text-slate-900">Mục tiêu nghề nghiệp</h2>
      <label className="mt-4 block"><span className="mb-1 block text-sm font-medium text-slate-700">Nội dung</span><Input.TextArea aria-label="Nội dung mục tiêu nghề nghiệp" rows={4} value={value} onChange={(event) => onChange(event.target.value)} placeholder="Mô tả ngắn về định hướng nghề nghiệp của bạn" /></label>
    </section>
  )
}
