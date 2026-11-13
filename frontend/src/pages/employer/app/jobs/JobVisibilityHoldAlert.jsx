import { Alert } from 'antd'
import dayjs from 'dayjs'

// The employer API sets `visibility_hold` while candidates cannot see a job.
export default function JobVisibilityHoldAlert({ hold }) {
  if (!hold) return null
  const heldAt = hold.held_at && dayjs(hold.held_at).isValid()
    ? dayjs(hold.held_at).format('DD/MM/YYYY HH:mm')
    : null
  return (
    <Alert
      type="warning"
      showIcon
      data-testid="job-visibility-hold"
      title={hold.kind === 'account'
        ? 'Tin đang bị tạm giữ theo trạng thái tài khoản'
        : 'Tin đang bị quản trị viên tạm ẩn'}
      description={(
        <div className="space-y-1">
          <p>Ứng viên không nhìn thấy tin này{heldAt ? ` từ ${heldAt}` : ''}.</p>
          <p>
            <strong>Tình trạng:</strong> {hold.label}
            {hold.reason_label && <> · <strong>Lý do:</strong> {hold.reason_label}</>}
          </p>
          <p>
            Trong thời gian này bạn không thể chỉnh sửa, gia hạn, mở lại hay sao chép tin.
            Chỉ quản trị viên mới khôi phục được hiển thị.
          </p>
        </div>
      )}
    />
  )
}
