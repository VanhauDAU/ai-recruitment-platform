import { Skeleton } from 'antd'

export function FilterSection({ title, children }) {
  return (
    <div className="border-t border-dashed border-gray-200 pt-4">
      <h4 className="mb-3 text-[15px] font-semibold text-gray-800">{title}</h4>
      {children}
    </div>
  )
}

export function FilterSkeleton({ rows = 4 }) {
  return (
    <div className="space-y-2.5">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton.Input key={i} active size="small" style={{ width: `${70 - i * 8}%` }} block />
      ))}
    </div>
  )
}

function Chip({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`cursor-pointer rounded-full border px-3 py-1.5 text-sm transition ${
        active
          ? 'border-[var(--brand-primary)] bg-green-50 font-medium text-[var(--brand-primary)]'
          : 'border-gray-200 bg-white text-gray-600 hover:border-[var(--brand-primary)] hover:text-[var(--brand-primary)]'
      }`}
    >
      {children}
    </button>
  )
}

export function SingleChips({ value, onChange, options, allLabel = 'Tất cả' }) {
  return (
    <div className="flex flex-wrap gap-2">
      <Chip active={!value} onClick={() => onChange('')}>{allLabel}</Chip>
      {options.map(([optionValue, label]) => (
        <Chip
          key={optionValue}
          active={value === optionValue}
          onClick={() => onChange(value === optionValue ? '' : optionValue)}
        >
          {label}
        </Chip>
      ))}
    </div>
  )
}

export function MultiChips({ values, onToggle, onClear, options, allLabel = 'Tất cả' }) {
  return (
    <div className="flex flex-wrap gap-2">
      <Chip active={values.length === 0} onClick={onClear}>{allLabel}</Chip>
      {options.map(([optionValue, label]) => (
        <Chip key={optionValue} active={values.includes(optionValue)} onClick={() => onToggle(optionValue)}>
          {label}
        </Chip>
      ))}
    </div>
  )
}
