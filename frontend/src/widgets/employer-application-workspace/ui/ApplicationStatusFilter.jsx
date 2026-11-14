import { Select } from 'antd'
import { RECRUITER_APPLICATION_STATUSES } from '@/entities/application'

const OPTIONS = [
  { value: '', label: 'Tất cả' },
  ...RECRUITER_APPLICATION_STATUSES.map(([value, label]) => ({ value, label })),
]

/** One compact control beside the search box instead of a block of chips. */
export default function ApplicationStatusFilter({ value, onChange }) {
  return (
    <Select
      aria-label="Lọc trạng thái hồ sơ"
      value={value || ''}
      options={OPTIONS}
      popupMatchSelectWidth={false}
      onChange={onChange}
    />
  )
}
