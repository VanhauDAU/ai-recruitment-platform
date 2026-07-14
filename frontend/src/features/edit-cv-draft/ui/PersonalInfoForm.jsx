import { Input } from 'antd'

const FIELDS = [
  ['full_name', 'Họ và tên'], ['headline', 'Chức danh / vị trí mong muốn'],
  ['email', 'Email'], ['phone', 'Số điện thoại'], ['address', 'Địa chỉ'],
]

export default function PersonalInfoForm({ personalInfo, onChange }) {
  return (
    <section aria-labelledby="personal-info-title" className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 id="personal-info-title" className="text-lg font-bold text-slate-900">Thông tin cá nhân</h2>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {FIELDS.map(([field, label]) => <label key={field} className={field === 'headline' || field === 'address' ? 'sm:col-span-2' : ''}><span className="mb-1 block text-sm font-medium text-slate-700">{label}</span><Input aria-label={label} value={personalInfo[field] || ''} onChange={(event) => onChange({ [field]: event.target.value })} /></label>)}
      </div>
    </section>
  )
}
