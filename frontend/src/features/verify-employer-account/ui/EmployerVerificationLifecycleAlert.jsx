import { Alert } from 'antd'

const LIFECYCLE_COPY = {
  revoked: {
    title: 'Xác thực nhà tuyển dụng đã bị thu hồi',
    consequence: 'Quyền xem dữ liệu ứng viên và duyệt tin đã bị khóa.',
  },
  expired: {
    title: 'Xác thực nhà tuyển dụng đã hết hiệu lực',
    consequence: 'Quyền xem dữ liệu ứng viên và duyệt tin đã bị khóa.',
  },
}

export default function EmployerVerificationLifecycleAlert({
  verificationCase,
  className = '',
}) {
  const copy = LIFECYCLE_COPY[verificationCase?.status]
  if (!copy) return null
  const reason = verificationCase?.decision_reason?.trim()

  return (
    <Alert
      className={className}
      showIcon
      type="error"
      title={copy.title}
      description={(
        <div className="space-y-1">
          <p>{copy.consequence} Hãy kiểm tra và cập nhật hồ sơ để nộp lại.</p>
          {reason && <p><strong>Lý do:</strong> {reason}</p>}
          <p>
            Nhãn “Đã duyệt” trên từng tài liệu chỉ là kết quả kiểm tra của lần trước;
            không có nghĩa xác thực tài khoản còn hiệu lực.
          </p>
        </div>
      )}
    />
  )
}
