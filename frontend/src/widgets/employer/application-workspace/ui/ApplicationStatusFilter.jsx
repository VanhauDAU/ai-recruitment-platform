import { Select } from 'antd'
import { RECRUITER_APPLICATION_STATUSES } from '@/entities/application/application'
import { m } from '@/shared/config/i18n'

const UNANSWERED = 'scope:unanswered'
const OPTIONS = [
  { value: UNANSWERED, label: m.employer_workspace_app_filter_unanswered() },
  ...RECRUITER_APPLICATION_STATUSES.map(([value, label]) => ({ value, label })),
]

/**
 * Trạng thái hồ sơ, gộp thêm nhóm "Chưa phản hồi" (tham số `scope`) để người dùng
 * chỉ cần một ô lọc. `scope=unread` từ liên kết sâu tương đương trạng thái "Mới".
 */
export default function ApplicationStatusFilter({ status, scope, onChange }) {
  const value = scope === 'unanswered' ? UNANSWERED : (scope === 'unread' ? 'submitted' : status || undefined)
  return (
    <Select
      aria-label={m.employer_workspace_app_filter_status()}
      placeholder={m.employer_workspace_app_status_placeholder()}
      allowClear
      value={value}
      options={OPTIONS}
      popupMatchSelectWidth={false}
      onChange={(next) => onChange(next === UNANSWERED
        ? { status: '', scope: 'unanswered' }
        : { status: next || '', scope: '' })}
    />
  )
}
