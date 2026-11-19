import { Alert, Button } from 'antd'
import dayjs from '@/shared/lib/dayjs'

const formatTime = (value) => (value && dayjs(value).isValid() ? dayjs(value).format('DD/MM/YYYY HH:mm') : null)

function changeRequestDescription(hold) {
  if (hold.resubmitted_at) {
    return `Bạn đã gửi duyệt lại lúc ${formatTime(hold.resubmitted_at)}. Tin vẫn ẩn cho tới khi quản trị viên xem lại.`
  }
  return 'Ứng viên chưa nhìn thấy tin. Chỉnh sửa theo yêu cầu rồi bấm "Gửi duyệt lại".'
}

// The employer API sets `visibility_hold` while an administrator or the
// account state keeps a job off the public site.
export default function JobVisibilityHoldAlert({ hold, onResubmit, resubmitting = false }) {
  if (!hold) return null
  const heldAt = formatTime(hold.held_at)
  if (hold.code === 'changes_requested') {
    return (
      <Alert
        type="warning"
        showIcon
        data-testid="job-visibility-hold"
        title={['Quản trị viên yêu cầu chỉnh sửa tin', hold.reason_label && `Lý do: ${hold.reason_label}`].filter(Boolean).join(' · ')}
        description={(
          <>
            {hold.request_note && <p className="m-0 whitespace-pre-line font-medium text-slate-700">{hold.request_note}</p>}
            <p className="m-0 mt-1">{changeRequestDescription(hold)}</p>
          </>
        )}
        action={hold.editable && onResubmit && (
          <Button type="primary" size="small" loading={resubmitting} onClick={onResubmit}>Gửi duyệt lại</Button>
        )}
      />
    )
  }
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
