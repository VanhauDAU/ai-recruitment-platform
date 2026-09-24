import {
  CheckCircleFilled,
  HistoryOutlined,
  KeyOutlined,
  MailOutlined,
  SafetyCertificateOutlined,
  UserOutlined,
} from '@ant-design/icons'
import { useSearchParams } from 'react-router'
import { useSession } from '@/entities/session'
import AdminActivityPanel from './AdminActivityPanel'
import AdminMyAccessPanel from './AdminMyAccessPanel'
import AdminProfilePanel from './AdminProfilePanel'
import AdminSecurityPanel from './AdminSecurityPanel'
import './admin-account-settings.css'

const TABS = [
  { key: 'profile', label: 'Hồ sơ', icon: <UserOutlined />, Panel: AdminProfilePanel },
  { key: 'security', label: 'Bảo mật', icon: <SafetyCertificateOutlined />, Panel: AdminSecurityPanel },
  { key: 'access', label: 'Quyền của tôi', icon: <KeyOutlined />, Panel: AdminMyAccessPanel },
  { key: 'activity', label: 'Nhật ký hoạt động', icon: <HistoryOutlined />, Panel: AdminActivityPanel },
]

const DEFAULT_TAB = TABS[0].key

/**
 * Trang cài đặt tài khoản dùng chung cho superuser và nhân viên quản trị.
 *
 * Tab đồng bộ với query `?tab=` để deep-link được (vd redirect từ route
 * `/my-access` cũ sang `?tab=access`). Tab không hợp lệ rơi về `profile`.
 */
export default function AdminAccountSettings() {
  const { user } = useSession()
  const [searchParams, setSearchParams] = useSearchParams()
  const requested = searchParams.get('tab')
  const activeKey = TABS.some((tab) => tab.key === requested) ? requested : DEFAULT_TAB
  const activeTab = TABS.find((tab) => tab.key === activeKey) || TABS[0]
  const isSuperuser = Boolean(user?.admin_access?.is_superuser || user?.is_superuser)
  const roleCount = user?.admin_access?.memberships?.length || 0

  function selectTab(key) {
    setSearchParams(key === DEFAULT_TAB ? {} : { tab: key }, { replace: true })
  }

  function handleTabKeyDown(event, index) {
    if (!['ArrowDown', 'ArrowUp', 'ArrowRight', 'ArrowLeft'].includes(event.key)) return

    event.preventDefault()
    const direction = event.key === 'ArrowDown' || event.key === 'ArrowRight' ? 1 : -1
    const nextKey = TABS[(index + direction + TABS.length) % TABS.length].key
    selectTab(nextKey)
    requestAnimationFrame(() => document.getElementById(`admin-account-tab-${nextKey}`)?.focus())
  }

  return (
    <section className="admin-account-settings">
      <aside className="admin-account-settings__rail">
        <header className="admin-account-settings__heading">
          <p className="admin-account-settings__eyebrow">Không gian quản trị</p>
          <h1 className="admin-account-settings__title">Tài khoản của tôi</h1>
        </header>

        <div className="admin-account-settings__status-grid" aria-label="Trạng thái tài khoản">
          <StatusItem icon={<MailOutlined />} label="Email" value={user?.email_verified ? 'Đã xác minh' : 'Chưa xác minh'} positive={Boolean(user?.email_verified)} />
          <StatusItem icon={<SafetyCertificateOutlined />} label="Xác thực 2 yếu tố" value={user?.two_factor_enabled ? 'Đang bật' : 'Chưa bật'} positive={Boolean(user?.two_factor_enabled)} />
          <StatusItem icon={<KeyOutlined />} label="Quyền truy cập" value={isSuperuser ? 'Superuser' : roleCount ? `${roleCount} vai trò` : 'Chưa được gán'} positive={isSuperuser || roleCount > 0} />
        </div>

        <nav className="admin-account-settings__tabs" aria-label="Các mục tài khoản" role="tablist" aria-orientation="vertical">
          {TABS.map(({ key, label, icon }, index) => (
            <button
              key={key}
              id={`admin-account-tab-${key}`}
              type="button"
              role="tab"
              aria-controls={`admin-account-panel-${key}`}
              aria-selected={key === activeKey}
              tabIndex={key === activeKey ? 0 : -1}
              className="admin-account-settings__tab"
              onClick={() => selectTab(key)}
              onKeyDown={(event) => handleTabKeyDown(event, index)}
            >
              {icon}<span>{label}</span>
            </button>
          ))}
        </nav>
      </aside>

      <section
        id={`admin-account-panel-${activeKey}`}
        className="admin-account-settings__content"
        role="tabpanel"
        aria-labelledby={`admin-account-tab-${activeKey}`}
        tabIndex={0}
      >
        <activeTab.Panel />
      </section>
    </section>
  )
}

function StatusItem({ icon, label, value, positive }) {
  return (
    <div className="admin-account-settings__status-item">
      <span className={`admin-account-settings__status-icon ${positive ? 'is-positive' : ''}`}>{positive ? <CheckCircleFilled /> : icon}</span>
      <span className="min-w-0">
        <span className="block text-xs font-medium text-slate-500">{label}</span>
        <span className="block truncate text-sm font-semibold text-slate-800">{value}</span>
      </span>
    </div>
  )
}
