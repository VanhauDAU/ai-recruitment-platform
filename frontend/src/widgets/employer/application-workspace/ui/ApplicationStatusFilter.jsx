import { Select } from 'antd'
import { RECRUITER_APPLICATION_STATUSES } from '@/entities/application/application'
import { m } from '@/shared/config/i18n'

const OPTIONS = [
  { value: '', label: m.employer_workspace_app_filter_all() },
  ...RECRUITER_APPLICATION_STATUSES.map(([value, label]) => ({ value, label })),
]

/** One compact control beside the search box instead of a block of chips. */
export default function ApplicationStatusFilter({ value, onChange }) {
  return (
    <Select
      aria-label={m.employer_workspace_app_filter_status()}
      value={value || ''}
      options={OPTIONS}
      popupMatchSelectWidth={false}
      onChange={onChange}
    />
  )
}
