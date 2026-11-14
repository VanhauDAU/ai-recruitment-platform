import { RECRUITER_APPLICATION_STATUSES } from '@/entities/application'

const CHIPS = [['', 'Tất cả'], ...RECRUITER_APPLICATION_STATUSES]

export default function ApplicationStatusFilter({ value, onChange }) {
  return (
    <div className="aw-chips" role="group" aria-label="Lọc trạng thái hồ sơ">
      {CHIPS.map(([status, label]) => (
        <button
          key={status || 'all'}
          type="button"
          className="aw-chip"
          aria-pressed={value === status}
          onClick={() => onChange(status)}
        >
          {label}
        </button>
      ))}
    </div>
  )
}
