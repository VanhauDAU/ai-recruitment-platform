import {
  CheckCircleOutlined,
  LockOutlined,
  MailOutlined,
  SolutionOutlined,
  TeamOutlined,
  UserAddOutlined,
} from '@ant-design/icons'

const count = (value) => Number(value || 0)
const vi = (value) => count(value).toLocaleString('vi-VN')

function StatCard({ icon, label, value, detail, tone, share }) {
  return (
    <article className={`account-stat account-stat--${tone}`}>
      <span className="account-stat__icon" aria-hidden="true">{icon}</span>
      <div className="account-stat__body">
        <p>{label}</p>
        <strong>{vi(value)}</strong>
        <span className="account-stat__meter">
          <i style={{ width: `${share}%` }} />
        </span>
        <span className="account-stat__detail">{detail}</span>
      </div>
    </article>
  )
}

function QueueCard({ icon, label, value, detail, tone, onClick }) {
  // Hàng chờ rỗng luôn về tông trung tính để mắt chỉ bắt vào việc thật sự cần xử lý.
  const shown = count(value) ? tone : 'slate'
  return (
    <button type="button" className={`account-queue account-queue--${shown}`} onClick={onClick}>
      <span className="account-queue__icon" aria-hidden="true">{icon}</span>
      <span className="account-queue__body">
        <span className="account-queue__label">{label}</span>
        <span className="account-queue__detail">{detail}</span>
      </span>
      <strong className="account-queue__value">{vi(value)}</strong>
    </button>
  )
}

/** Dải thống kê tài khoản và các hàng chờ mở thẳng sang tab xử lý tương ứng. */
export default function AccountOverview({
  summary,
  canViewEmployerVerifications,
  canInvite,
  onOpenQueue,
}) {
  const share = (value) => (
    count(summary.total) ? Math.round((count(value) / count(summary.total)) * 100) : 0
  )
  const overdue = count(summary.employer_verification_overdue)
  // Mỗi thẻ hàng chờ mở đúng tab xử lý nên chỉ hiện khi có quyền vào tab đó.
  const queues = [
    ...(canViewEmployerVerifications ? [
      {
        key: 'verification',
        icon: <SolutionOutlined />,
        label: 'Hồ sơ NTD chờ duyệt',
        value: summary.employer_verification_pending,
        tone: overdue > 0 ? 'red' : 'amber',
        detail: overdue > 0
          ? `${vi(overdue)} hồ sơ đã chờ quá 72 giờ`
          : 'Không có hồ sơ quá hạn',
      },
    ] : []),
    ...(canInvite ? [{
      key: 'invitations',
      icon: <UserAddOutlined />,
      label: 'Admin chờ kích hoạt',
      value: summary.pending_admin,
      tone: 'brand',
      detail: 'Đã mời nhưng chưa đăng nhập',
    }] : []),
  ]
  const queueTotal = queues.reduce((sum, item) => sum + count(item.value), 0)

  return (
    <section className="account-overview" aria-label="Tổng quan tài khoản">
      <div className="account-stats">
        {/* Thẻ tổng luôn đầy 100%: đây là mốc mà ba thẻ còn lại chia tỷ lệ, đồng
            thời giữ mọi thẻ cùng số dòng để các con số thẳng hàng nhau. */}
        <StatCard
          tone="brand"
          icon={<TeamOutlined />}
          label="Tổng tài khoản"
          value={summary.total}
          share={100}
          detail="Trong phạm vi bạn được xem"
        />
        <StatCard
          tone="green"
          icon={<CheckCircleOutlined />}
          label="Đang hoạt động"
          value={summary.active}
          share={share(summary.active)}
          detail={`${share(summary.active)}% tài khoản đăng nhập được`}
        />
        <StatCard
          tone="red"
          icon={<LockOutlined />}
          label="Bị hạn chế"
          value={summary.restricted}
          share={share(summary.restricted)}
          detail={`${share(summary.restricted)}% đang tạm khóa hoặc bị cấm`}
        />
        <StatCard
          tone="slate"
          icon={<MailOutlined />}
          label="Email chưa xác minh"
          value={summary.unverified}
          share={share(summary.unverified)}
          detail={`${share(summary.unverified)}% chưa hoàn tất xác thực`}
        />
      </div>

      {queues.length > 0 && (
        <div className="account-queues">
          <p className="account-queues__title">
            Hàng chờ cần xử lý
            <span>{vi(queueTotal)} việc đang chờ</span>
          </p>
          <div className="account-queues__grid">
            {queues.map(({ key, ...item }) => (
              <QueueCard key={key} {...item} onClick={() => onOpenQueue(key)} />
            ))}
          </div>
        </div>
      )}
    </section>
  )
}
