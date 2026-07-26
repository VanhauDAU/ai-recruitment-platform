import { HistoryOutlined, KeyOutlined, SafetyCertificateOutlined, UserOutlined } from '@ant-design/icons'
import { Tabs } from 'antd'
import { useSearchParams } from 'react-router-dom'
import AdminActivityPanel from './AdminActivityPanel'
import AdminMyAccessPanel from './AdminMyAccessPanel'
import AdminProfilePanel from './AdminProfilePanel'
import AdminSecurityPanel from './AdminSecurityPanel'

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
  const [searchParams, setSearchParams] = useSearchParams()
  const requested = searchParams.get('tab')
  const activeKey = TABS.some((tab) => tab.key === requested) ? requested : DEFAULT_TAB

  return (
    <Tabs
      activeKey={activeKey}
      onChange={(key) => setSearchParams(key === DEFAULT_TAB ? {} : { tab: key }, { replace: true })}
      className="[&_.ant-tabs-tab]:!py-2"
      items={TABS.map(({ key, label, icon, Panel }) => ({
        key,
        label: <span className="whitespace-nowrap">{icon} {label}</span>,
        children: <Panel />,
      }))}
    />
  )
}
