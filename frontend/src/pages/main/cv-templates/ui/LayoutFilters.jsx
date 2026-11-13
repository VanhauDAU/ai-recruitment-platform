const GROUPS = [
  { key: 'anh', label: 'Ảnh đại diện', options: [{ value: 'co', label: 'Có ảnh' }, { value: 'khong', label: 'Không ảnh' }] },
  { key: 'cot', label: 'Bố cục', options: [{ value: '1', label: 'Một cột' }, { value: '2', label: 'Hai cột' }] },
]

// Lọc theo hình thức mẫu: có ảnh hay không, một hay hai cột. Bấm lại để bỏ lọc.
export default function LayoutFilters({ value, onChange }) {
  return <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
    {GROUPS.map((group) => <div key={group.key} role="group" aria-label={group.label} className="flex items-center gap-1.5">
      <span className="text-xs font-semibold text-slate-500">{group.label}:</span>
      {group.options.map((option) => {
        const active = value[group.key] === option.value
        return <button key={option.value} type="button" aria-pressed={active} onClick={() => onChange(group.key, active ? null : option.value)}
          className={`rounded-full border px-3 py-1 text-xs font-medium transition ${active ? 'border-[var(--brand-primary)] bg-[var(--brand-primary)] text-white' : 'border-slate-200 bg-white text-slate-600 hover:border-[var(--brand-primary)]'}`}>
          {option.label}
        </button>
      })}
    </div>)}
  </div>
}
