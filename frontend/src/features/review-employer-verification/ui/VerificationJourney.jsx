import {
  AuditOutlined,
  BankOutlined,
  CheckOutlined,
  FileProtectOutlined,
  IdcardOutlined,
  MailOutlined,
  PhoneOutlined,
  SafetyCertificateOutlined,
  SolutionOutlined,
} from '@ant-design/icons'
import { VERIFICATION_CHECK_LABELS } from '@/entities/admin-employer-verification'

const CHECK_DETAILS = {
  email_verified: {
    description: 'Địa chỉ email đăng nhập đã được xác nhận.',
    icon: MailOutlined,
  },
  registration_completed: {
    description: 'Thông tin nhà tuyển dụng đã được khai báo đầy đủ.',
    icon: IdcardOutlined,
  },
  consulting_need_completed: {
    description: 'Nhu cầu và quy mô tuyển dụng đã được ghi nhận.',
    icon: SolutionOutlined,
  },
  phone_verified: {
    description: 'Số điện thoại liên hệ đã được xác minh.',
    icon: PhoneOutlined,
  },
  company_linked: {
    description: 'Tài khoản đã được gắn với đúng hồ sơ doanh nghiệp.',
    icon: BankOutlined,
  },
  representative_documents_submitted: {
    description: 'Đã có đủ giấy tờ chứng minh quyền đại diện.',
    icon: AuditOutlined,
  },
  business_documents_approved: {
    description: 'Admin đã đối chiếu và duyệt giấy tờ doanh nghiệp.',
    icon: SafetyCertificateOutlined,
  },
  candidate_dpa_approved: {
    description: 'Văn bản xử lý dữ liệu ứng viên đã được duyệt.',
    icon: FileProtectOutlined,
  },
  dpa_accepted: {
    description: 'Nhà tuyển dụng đã chấp nhận DPA của nền tảng.',
    icon: SafetyCertificateOutlined,
  },
}

function completionCopy(completedCount, totalCount) {
  if (completedCount === totalCount) {
    return {
      title: 'Hồ sơ đã hoàn tất toàn bộ điều kiện',
      description: 'Cả 9 bước xác thực đều đã được đáp ứng và lưu vết trên hệ thống.',
      status: 'Đã hoàn tất',
    }
  }

  const remainingCount = totalCount - completedCount
  return {
    title: 'Theo dõi hành trình xác thực',
    description: `Còn ${remainingCount} bước cần hoàn thiện trước khi hồ sơ đủ điều kiện xác thực.`,
    status: `Còn ${remainingCount} bước`,
  }
}

export default function VerificationJourney({ checks = {} }) {
  const steps = Object.entries(VERIFICATION_CHECK_LABELS)
  const totalCount = steps.length
  const completedCount = steps.filter(([key]) => Boolean(checks[key])).length
  const progressPercent = totalCount ? Math.round((completedCount / totalCount) * 100) : 0
  const firstPendingIndex = steps.findIndex(([key]) => !checks[key])
  const complete = completedCount === totalCount
  const copy = completionCopy(completedCount, totalCount)

  return (
    <section
      className={`verification-journey ${complete ? 'is-complete' : 'is-in-progress'}`}
      aria-labelledby="verification-journey-title"
    >
      <header className="verification-journey__header">
        <div
          className="verification-journey__ring"
          role="progressbar"
          aria-label="Tiến độ 9 bước xác thực"
          aria-valuemin={0}
          aria-valuemax={totalCount}
          aria-valuenow={completedCount}
          aria-valuetext={`${completedCount} trên ${totalCount} bước đã hoàn tất`}
          style={{ '--verification-progress': `${progressPercent * 3.6}deg` }}
        >
          <span className="verification-journey__ring-content">
            <strong>{completedCount}</strong>
            <small>{`/${totalCount}`}</small>
          </span>
        </div>

        <div className="verification-journey__summary">
          <span className="verification-journey__eyebrow">Hành trình 9 bước</span>
          <h3 id="verification-journey-title">{copy.title}</h3>
          <p>{copy.description}</p>
        </div>

        <span className="verification-journey__status">
          {complete && <CheckOutlined aria-hidden="true" />}
          {copy.status}
        </span>
      </header>

      <div className="verification-journey__track" aria-hidden="true">
        <span style={{ width: `${progressPercent}%` }} />
      </div>

      <ol className="verification-checklist" aria-label="Chi tiết 9 bước xác thực">
        {steps.map(([key, label], index) => {
          const done = Boolean(checks[key])
          const current = !done && index === firstPendingIndex
          const Icon = CHECK_DETAILS[key]?.icon || SafetyCertificateOutlined
          const stepStatus = done ? 'Đã hoàn tất' : current ? 'Cần xử lý tiếp' : 'Đang chờ'

          return (
            <li
              key={key}
              className={`${done ? 'is-complete' : 'is-pending'} ${current ? 'is-current' : ''}`}
              style={{ '--step-index': index }}
              aria-current={current ? 'step' : undefined}
            >
              <span className="verification-checklist__marker" aria-hidden="true">
                {done ? <CheckOutlined /> : <Icon />}
              </span>
              <div className="verification-checklist__content">
                <span className="verification-checklist__meta">
                  {`Bước ${String(index + 1).padStart(2, '0')}`}
                </span>
                <strong>{label}</strong>
                <small>{CHECK_DETAILS[key]?.description}</small>
              </div>
              <span className="verification-checklist__status">{stepStatus}</span>
            </li>
          )
        })}
      </ol>
    </section>
  )
}
