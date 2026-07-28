import {
  BankOutlined,
  CheckCircleOutlined,
  LinkOutlined,
  LockOutlined,
  MailOutlined,
  SafetyCertificateOutlined,
  TeamOutlined,
  UserAddOutlined,
} from '@ant-design/icons'

const count = (value) => Number(value || 0)
const vi = (value) => count(value).toLocaleString('vi-VN')

function StatCard({ icon, label, value, detail, tone, share, onClick }) {
  return (
    <button
      type="button"
      className={`account-stat account-stat--${tone}`}
      onClick={onClick}
    >
      <span className="account-stat__icon" aria-hidden="true">{icon}</span>
      <span className="account-stat__body">
        <span className="account-stat__label">{label}</span>
        <strong>{vi(value)}</strong>
        <span className="account-stat__meter">
          <i style={{ width: `${share}%` }} />
        </span>
        <span className="account-stat__detail">{detail}</span>
      </span>
    </button>
  )
}

function QueueCard({ icon, label, value, detail, tone, onClick }) {
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

export default function AccountOverview({
  metrics = {},
  recruiterSummary,
  pendingInvitations = 0,
  canInvite = false,
  onApplyFilter,
  onOpenQueue,
}) {
  const total = count(metrics.total)
  const share = (value) => (total ? Math.round((count(value) / total) * 100) : 0)

  if (recruiterSummary) {
    const verification = recruiterSummary.verification || {}
    return (
      <section className="account-overview" aria-label="Tổng quan nhà tuyển dụng">
        <div className="account-stats">
          <StatCard
            tone="brand"
            icon={<TeamOutlined />}
            label="Tổng nhà tuyển dụng"
            value={metrics.total}
            share={100}
            detail="Trong phạm vi được xem"
            onClick={() => onApplyFilter('all')}
          />
          <StatCard
            tone="green"
            icon={<CheckCircleOutlined />}
            label="Đang hoạt động"
            value={metrics.active}
            share={share(metrics.active)}
            detail={`${share(metrics.active)}% tài khoản NTD`}
            onClick={() => onApplyFilter('active')}
          />
          <StatCard
            tone="amber"
            icon={<LinkOutlined />}
            label="Chưa liên kết công ty"
            value={recruiterSummary.companyless}
            share={share(recruiterSummary.companyless)}
            detail="Cần hoàn thiện quan hệ doanh nghiệp"
            onClick={() => onApplyFilter('companyless')}
          />
          <StatCard
            tone="amber"
            icon={<SafetyCertificateOutlined />}
            label="Chờ xác thực"
            value={verification.pending}
            share={share(verification.pending)}
            detail={`${vi(verification.overdue)} hồ sơ quá hạn 72 giờ`}
            onClick={() => onOpenQueue('verification')}
          />
        </div>
      </section>
    )
  }

  return (
    <section className="account-overview" aria-label="Tổng quan tài khoản">
      <div className="account-stats">
        <StatCard
          tone="brand"
          icon={<TeamOutlined />}
          label="Tổng tài khoản"
          value={metrics.total}
          share={100}
          detail="Ứng viên và quản trị viên"
          onClick={() => onApplyFilter('all')}
        />
        <StatCard
          tone="green"
          icon={<CheckCircleOutlined />}
          label="Đang hoạt động"
          value={metrics.active}
          share={share(metrics.active)}
          detail={`${share(metrics.active)}% tài khoản`}
          onClick={() => onApplyFilter('active')}
        />
        <StatCard
          tone="red"
          icon={<LockOutlined />}
          label="Bị hạn chế"
          value={metrics.restricted}
          share={share(metrics.restricted)}
          detail="Tạm khóa hoặc đã cấm"
          onClick={() => onApplyFilter('restricted')}
        />
        <StatCard
          tone="slate"
          icon={<MailOutlined />}
          label="Email chưa xác minh"
          value={metrics.unverified}
          share={share(metrics.unverified)}
          detail="Chưa hoàn tất xác thực email"
          onClick={() => onApplyFilter('unverified')}
        />
      </div>

      {canInvite && (
        <div className="account-queues">
          <p className="account-queues__title">
            Hàng chờ quản trị
            <span>{vi(pendingInvitations)} việc đang chờ</span>
          </p>
          <div className="account-queues__grid">
            <QueueCard
              icon={<UserAddOutlined />}
              label="Lời mời quản trị đang chờ"
              value={pendingInvitations}
              tone="brand"
              detail="Đã gửi nhưng chưa được chấp nhận"
              onClick={() => onOpenQueue('invitations')}
            />
            <QueueCard
              icon={<BankOutlined />}
              label="Phạm vi số liệu"
              value={metrics.total}
              tone="slate"
              detail="Không bao gồm tài khoản NTD"
              onClick={() => onApplyFilter('all')}
            />
          </div>
        </div>
      )}
    </section>
  )
}
