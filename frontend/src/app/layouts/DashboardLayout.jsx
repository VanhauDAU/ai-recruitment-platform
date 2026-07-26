import {
  AppstoreOutlined,
  ContactsOutlined,
  FileDoneOutlined,
  FileTextOutlined,
  IdcardOutlined,
  KeyOutlined,
  LogoutOutlined,
  MenuFoldOutlined,
  MenuOutlined,
  MenuUnfoldOutlined,
  SafetyCertificateOutlined,
  SettingOutlined,
  SolutionOutlined,
  UserOutlined,
} from '@ant-design/icons'
import { Avatar, Button, ConfigProvider, Drawer, Layout, Menu, Typography } from 'antd'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import {
  canAccessAdminRoute,
  useAdminAccess,
} from '@/entities/admin-access'
import { useSession } from '@/entities/session'
import { BrandLogo } from '@/entities/site-settings'
import { adminPath } from '@/shared/config/portals'
import { ADMIN_ROUTES } from '../router/admin/admin-routes.config'
import EmployerWorkspaceLayout from './EmployerWorkspaceLayout'
import './admin-dashboard.css'

const { Header, Sider, Content } = Layout

const ICONS = {
  access: <KeyOutlined />,
  account: <IdcardOutlined />,
  cv: <FileTextOutlined />,
  dashboard: <AppstoreOutlined />,
  leads: <ContactsOutlined />,
  moderation: <FileDoneOutlined />,
  services: <SolutionOutlined />,
  settings: <SettingOutlined />,
  shield: <SafetyCertificateOutlined />,
}

function AdminNavigation({ items, pathname, navigate, onNavigate, collapsed = false }) {
  const groupedItems = [
    {
      type: 'group',
      label: 'Vận hành',
      children: items
        .filter((item) => item.navGroup === 'operations')
        .map((item) => ({
          key: item.path,
          icon: ICONS[item.iconKey],
          label: item.navLabel,
        })),
    },
    {
      type: 'group',
      label: 'Hệ thống',
      children: items
        .filter((item) => item.navGroup === 'system')
        .map((item) => ({
          key: item.path,
          icon: ICONS[item.iconKey],
          label: item.navLabel,
        })),
    },
  ].filter((group) => group.children.length)

  return (
    <Menu
      theme="dark"
      mode="inline"
      inlineCollapsed={collapsed}
      selectedKeys={[pathname]}
      items={groupedItems}
      onClick={({ key }) => {
        navigate(key)
        onNavigate?.()
      }}
    />
  )
}

function AdminBrand({ collapsed = false }) {
  return (
    <div className={`admin-sider__brand ${collapsed ? 'admin-sider__brand--collapsed' : ''}`}>
      <BrandLogo
        dark
        className={collapsed ? 'justify-center' : 'min-w-0'}
        imageClassName={collapsed ? 'h-8 w-8 object-contain object-left' : 'h-8 max-w-[148px]'}
        textClassName="text-sm"
      />
      {!collapsed && <span className="admin-sider__product">Admin Console</span>}
    </div>
  )
}

export default function DashboardLayout() {
  const { user, logout } = useSession()
  const adminAccess = useAdminAccess(user)
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const mainRef = useRef(null)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const items = useMemo(() => user?.role === 'admin'
    ? ADMIN_ROUTES
      .filter(
        (route) => route.showInNav && canAccessAdminRoute(route, adminAccess),
      )
      .map((route) => ({
        ...route,
        path: adminPath(route.segment),
      }))
    : [], [adminAccess, user?.role])
  const hasNoDepartment = (
    user?.role === 'admin'
    && !adminAccess.isSuperuser
    && adminAccess.memberships.length === 0
  )
  const currentRoute = items.find((item) => item.path === pathname)

  useEffect(() => {
    mainRef.current?.focus({ preventScroll: true })
    setMobileNavOpen(false)
  }, [pathname])

  if (user?.role === 'employer') return <EmployerWorkspaceLayout />

  return (
    <ConfigProvider
      theme={{
        token: {
          colorPrimary: '#0369a1',
          borderRadius: 10,
          colorText: '#0f172a',
          colorTextSecondary: '#64748b',
          colorBorder: '#e2e8f0',
          controlHeight: 40,
        },
      }}
    >
      <Layout className="admin-shell">
        <a className="admin-skip-link" href="#admin-main">Bỏ qua điều hướng</a>
        <Sider
          className="admin-sider !hidden lg:!block"
          width={248}
          collapsedWidth={80}
          collapsed={sidebarCollapsed}
          trigger={null}
        >
          <AdminBrand collapsed={sidebarCollapsed} />
          <AdminNavigation
            items={items}
            pathname={pathname}
            navigate={navigate}
            collapsed={sidebarCollapsed}
          />
          {hasNoDepartment && !sidebarCollapsed && (
            <p className="admin-sider__notice">
              Tài khoản chưa được gán phòng ban. Liên hệ quản trị hệ thống
              (superuser) để được cấp quyền.
            </p>
          )}
        </Sider>

        <Drawer
          open={mobileNavOpen}
          placement="left"
          size={288}
          closable={false}
          onClose={() => setMobileNavOpen(false)}
          styles={{ body: { padding: 0, background: '#0b172a' } }}
        >
          <nav className="admin-sider min-h-full" aria-label="Điều hướng quản trị">
            <AdminBrand />
            <AdminNavigation
              items={items}
              pathname={pathname}
              navigate={navigate}
              onNavigate={() => setMobileNavOpen(false)}
            />
            {hasNoDepartment && <p className="admin-sider__notice">Tài khoản chưa được gán phòng ban. Liên hệ quản trị hệ thống để được cấp quyền.</p>}
          </nav>
        </Drawer>

        <Layout className="!min-w-0 !bg-transparent">
          <Header className="admin-topbar">
            <div className="flex min-w-0 items-center gap-3">
              <Button
                className="admin-icon-button lg:!hidden"
                icon={<MenuOutlined />}
                aria-label="Mở điều hướng"
                onClick={() => setMobileNavOpen(true)}
              />
              <Button
                className="admin-icon-button !hidden lg:!inline-flex"
                icon={sidebarCollapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
                aria-label={sidebarCollapsed ? 'Mở rộng thanh điều hướng' : 'Thu gọn thanh điều hướng'}
                onClick={() => setSidebarCollapsed((value) => !value)}
              />
              <div className="admin-topbar__location min-w-0">
                <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400">Không gian làm việc</p>
                <p className="truncate text-sm font-semibold text-slate-800">
                  {`Đang ở: ${currentRoute?.title || 'Quản trị hệ thống'}`}
                </p>
              </div>
            </div>

            <div className="admin-user">
              <button
                type="button"
                className="flex min-w-0 cursor-pointer items-center gap-3 border-0 bg-transparent p-0 text-left"
                title="Cài đặt tài khoản"
                onClick={() => navigate(adminPath('/account'))}
              >
                <Avatar className="admin-user__avatar" size={40} src={user?.avatar_url || undefined} icon={<UserOutlined />} />
                <div className="admin-user__meta min-w-0 max-w-64">
                  <Typography.Text strong ellipsis className="!block !text-sm">
                    {user?.full_name || 'Quản trị viên'}
                  </Typography.Text>
                  <div className="mt-0.5 flex min-w-0 items-center gap-1">
                    {adminAccess.memberships[0] ? (
                      <Typography.Text type="secondary" ellipsis className="!text-xs">
                        {`${adminAccess.memberships[0].department.name} · ${adminAccess.memberships[0].role.name}`}
                      </Typography.Text>
                    ) : (
                      <Typography.Text type="secondary" ellipsis className="!text-xs">
                        {user?.email}
                      </Typography.Text>
                    )}
                  </div>
                </div>
              </button>
              <Button
                className="admin-icon-button"
                icon={<LogoutOutlined />}
                aria-label="Đăng xuất"
                title="Đăng xuất"
                onClick={logout}
              />
            </div>
          </Header>
          <Content>
            <main id="admin-main" ref={mainRef} tabIndex={-1} className="admin-main">
              <Outlet context={{ availableRoutes: items, adminAccess }} />
            </main>
          </Content>
        </Layout>
      </Layout>
    </ConfigProvider>
  )
}
