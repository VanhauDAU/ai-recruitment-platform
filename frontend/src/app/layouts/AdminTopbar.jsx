import {
  FileAddOutlined,
  HistoryOutlined,
  MenuFoldOutlined,
  MenuOutlined,
  MenuUnfoldOutlined,
  NotificationOutlined,
  PlusOutlined,
  QuestionCircleOutlined,
  ReadOutlined,
  SafetyCertificateOutlined,
  ThunderboltOutlined,
  UserAddOutlined,
  UserOutlined,
} from '@ant-design/icons'
import { Avatar, Button, Dropdown, Layout, Popover, Tag } from 'antd'
import { useNavigate } from 'react-router'
import { adminTierLabel } from '@/entities/account/admin-account'
import { adminPath } from '@/shared/config/portals'
import { AdminQueueBell } from '@/widgets/admin/queue-bell'

const { Header } = Layout

const soon = (label) => (
  <span className="admin-topbar__menu-soon">
    {label}
    <Tag className="admin-nav__coming-soon">Sắp ra mắt</Tag>
  </span>
)

function HelpPopover() {
  return (
    <div className="admin-topbar__help">
      <strong>Trung tâm hướng dẫn quản trị</strong>
      <p>Quy trình duyệt hồ sơ, xử lý báo cáo và phím tắt sẽ được gom tại đây.</p>
      <Tag className="admin-nav__coming-soon">Sắp ra mắt</Tag>
    </div>
  )
}

export default function AdminTopbar({
  user,
  isSuperuser,
  breadcrumb,
  title,
  queueSummary,
  sidebarCollapsed,
  onOpenMobileNav,
  onToggleSidebar,
}) {
  const navigate = useNavigate()
  const createItems = [
    { key: '/blog/tao-moi', icon: <FileAddOutlined />, label: 'Bài viết cẩm nang' },
    { key: '/tro-giup/tao-moi', icon: <ReadOutlined />, label: 'Nội dung FAQ & hướng dẫn' },
    { key: '/thong-bao', icon: <NotificationOutlined />, label: 'Thông báo đa cổng' },
    ...(isSuperuser
      ? [{ key: '/tai-khoan?tab=invitations', icon: <UserAddOutlined />, label: 'Mời quản trị viên' }]
      : []),
    { type: 'divider' },
    { key: 'job-on-behalf', icon: <ThunderboltOutlined />, label: soon('Đăng tin hộ NTD'), disabled: true },
  ]
  const accountItems = [
    {
      key: 'identity',
      type: 'group',
      label: (
        <span className="admin-topbar__menu-identity">
          <strong>{user?.full_name || user?.email}</strong>
          <span>{user?.email}</span>
        </span>
      ),
    },
    { type: 'divider' },
    { key: '/tai-khoan-cua-toi', icon: <UserOutlined />, label: 'Hồ sơ của tôi' },
    { key: '/tai-khoan-cua-toi?tab=security', icon: <SafetyCertificateOutlined />, label: 'Bảo mật và phiên đăng nhập' },
    { key: '/tai-khoan-cua-toi?tab=activity', icon: <HistoryOutlined />, label: 'Nhật ký hoạt động' },
  ]
  const go = ({ key }) => navigate(adminPath(key))

  return (
    <Header className="admin-topbar">
      <div className="admin-topbar__start">
        <Button
          className="admin-icon-button admin-topbar__mobile-toggle"
          icon={<MenuOutlined />}
          aria-label="Mở điều hướng"
          onClick={onOpenMobileNav}
        />
        <Button
          className="admin-icon-button admin-topbar__desktop-toggle"
          icon={sidebarCollapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
          aria-label={sidebarCollapsed ? 'Mở rộng thanh điều hướng' : 'Thu gọn thanh điều hướng'}
          onClick={onToggleSidebar}
        />
        <div className="admin-topbar__location">
          {breadcrumb.length > 0 && (
            <nav aria-label="Vị trí hiện tại" className="admin-topbar__breadcrumb">
              <ol>
                {breadcrumb.map((label) => <li key={label}>{label}</li>)}
              </ol>
            </nav>
          )}
          {/* The page heading lives here, so every admin page shares one h1. */}
          <div className="admin-topbar__title">
            Đang ở: <h1 className="admin-topbar__heading">{title || 'Quản trị hệ thống'}</h1>
          </div>
        </div>
      </div>

      <div className="admin-topbar__actions">
        <Dropdown menu={{ items: createItems, onClick: go }} trigger={['click']} placement="bottomRight">
          <Button type="primary" icon={<PlusOutlined />} className="admin-topbar__create" aria-label="Tạo mới">
            <span className="admin-topbar__create-label">Tạo mới</span>
          </Button>
        </Dropdown>
        <AdminQueueBell summary={queueSummary} />
        <Popover content={<HelpPopover />} trigger="click" placement="bottomRight" arrow={false}>
          <Button className="admin-icon-button admin-topbar__help-button" icon={<QuestionCircleOutlined />} aria-label="Trợ giúp" />
        </Popover>
        <Dropdown menu={{ items: accountItems, onClick: go }} trigger={['click']} placement="bottomRight">
          <button type="button" className="admin-user" aria-label="Menu tài khoản">
            <Avatar className="admin-user__avatar" size={36} src={user?.avatar_url || undefined} icon={<UserOutlined />} />
            <span className="admin-user__meta">
              <strong>{user?.full_name || 'Quản trị viên'}</strong>
              <span>{adminTierLabel(user?.admin_access)}</span>
            </span>
          </button>
        </Dropdown>
      </div>
    </Header>
  )
}
