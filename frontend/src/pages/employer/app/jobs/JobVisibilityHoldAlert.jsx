import { Alert } from 'antd'
import dayjs from 'dayjs'

// The employer API sets `visibility_hold` while candidates cannot see a job.
export default function JobVisibilityHoldAlert({ hold }) {
  if (!hold) return null
  const heldAt = hold.held_at && dayjs(hold.held_at).isValid()
    ? dayjs(hold.held_at).format('DD/MM/YYYY HH:mm')
    : null
  const headline = hold.kind === 'account'
    ? 'Tin đang bị tạm giữ theo trạng thái tài khoản'
    : 'Tin đang bị quản trị viên tạm ẩn'
  return (
    <Alert
      type="warning"
      showIcon
      data-testid="job-visibility-hold"
      title={[headline, hold.label, hold.reason_label && `Lý do: ${hold.reason_label}`].filter(Boolean).join(' · ')}
      description={`Ứng viên không nhìn thấy tin${heldAt ? ` từ ${heldAt}` : ''}. Bạn chưa thể chỉnh sửa, gia hạn, mở lại hay sao chép tin cho tới khi quản trị viên khôi phục.`}
    />
  )
}
