import { LogoutOutlined, SettingOutlined, UserOutlined } from '@ant-design/icons'
import { Avatar, Button, Tooltip } from 'antd'
import { Link } from 'react-router'
import { adminTierLabel } from '@/entities/account/admin-account'
import { adminPath } from '@/shared/config/portals'
import ConfirmAction from '@/shared/ui/confirm-action/ConfirmAction'

/** Identity, account settings and sign-out on one row at the bottom of the admin sidebar. */
export default function AdminSidebarFooter({ user, logout, collapsed = false, onNavigate }) {
  const name = user?.full_name || user?.email || 'Quản trị viên'
  const logoutButton = (
    <ConfirmAction
      title="Đăng xuất"
      description="Bạn có chắc muốn đăng xuất khỏi phiên này? Bạn sẽ cần đăng nhập lại để tiếp tục quản lý hệ thống."
      confirmText="Đăng xuất"
      cancelText="Ở lại"
      danger
      onConfirm={logout}
    >
      <Button
        className="admin-sider-footer__logout"
        icon={<LogoutOutlined />}
        aria-label="Đăng xuất"
        title="Đăng xuất"
        type="text"
      />
    </ConfirmAction>
  )

  if (collapsed) {
    return (
      <div className="admin-sider-footer admin-sider-footer--collapsed">
        <Tooltip placement="right" title={`${name}, ${adminTierLabel(user?.admin_access)}`}>
          <Link to={adminPath('/account')} aria-label="Tài khoản của tôi" className="admin-sider-footer__avatar-link">
            <Avatar size={34} src={user?.avatar_url || undefined} icon={<UserOutlined />} className="admin-user__avatar" />
          </Link>
        </Tooltip>
        {logoutButton}
      </div>
    )
  }

  return (
    <div className="admin-sider-footer">
      <div className="admin-sider-footer__identity">
        <Avatar size={34} src={user?.avatar_url || undefined} icon={<UserOutlined />} className="admin-user__avatar" />
        <div className="admin-sider-footer__meta">
          <strong title={name}>{name}</strong>
          <span>{adminTierLabel(user?.admin_access)}</span>
        </div>
        <Tooltip title="Tài khoản của tôi">
          <Link
            to={adminPath('/account')}
            className="admin-sider-footer__settings"
            aria-label="Tài khoản của tôi"
            onClick={onNavigate}
          >
            <SettingOutlined />
          </Link>
        </Tooltip>
        {logoutButton}
      </div>
    </div>
  )
}
