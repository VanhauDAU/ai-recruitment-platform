import {
  CheckCircleOutlined,
  LockOutlined,
  MailOutlined,
  TeamOutlined,
} from '@ant-design/icons'
import { getIntlLocale } from '@/shared/config/i18n'

const count = (value) => Number(value || 0)
const vi = (value) => count(value).toLocaleString(getIntlLocale())

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

export default function AccountOverview({ metrics = {}, onApplyFilter }) {
  const total = count(metrics.total)
  const share = (value) => (total ? Math.round((count(value) / total) * 100) : 0)

  return (
    <section className="account-stats" aria-label="Tổng quan tài khoản">
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
    </section>
  )
}
