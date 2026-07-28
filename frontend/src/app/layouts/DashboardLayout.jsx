import {
  LogoutOutlined,
  MenuFoldOutlined,
  MenuOutlined,
  MenuUnfoldOutlined,
  UserOutlined,
} from '@ant-design/icons'
import { Avatar, Button, ConfigProvider, Drawer, Layout, Popconfirm, Typography } from 'antd'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router'
import {
  canAccessAdminRoute,
  useAdminAccess,
} from '@/entities/admin-access'
import { useSession } from '@/entities/session'
import { BrandLogo } from '@/entities/site-settings'
import { adminPath } from '@/shared/config/portals'
import { ADMIN_ROUTES } from '../router/admin/admin-routes.config'
import { ADMIN_NAVIGATION } from '../router/admin/admin-navigation.config'
import {
  buildAdminNavigation,
  findActiveAdminNavigation,
} from '../router/admin/admin-navigation'
import AdminNavigation from './AdminNavigation'
import EmployerWorkspaceLayout from './EmployerWorkspaceLayout'
import './admin-dashboard.css'

const { Header, Sider, Content } = Layout

function AdminBrand({ collapsed = false }) {
  return (
    <div className={`admin-sider__brand ${collapsed ? 'admin-sider__brand--collapsed' : ''}`}>
      <BrandLogo
        dark
        className={collapsed ? 'justify-center' : 'min-w-0'}
        imageClassName={collapsed ? 'h-8 w-8 object-contain object-left' : 'h-8 max-w-[148px]'}
        textClassName="text-sm"
      />
      {!collapsed && <span className="admin-sider__product">ProCV - Quản trị</span>}
    </div>
  )
}

export default function DashboardLayout() {
  const { user, logout } = useSession()
  const adminAccess = useAdminAccess(user)
  const navigate = useNavigate()
  const { pathname, search } = useLocation()
  const mainRef = useRef(null)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [sidebarPeek, setSidebarPeek] = useState(false)
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const availableRoutes = useMemo(() => user?.role === 'admin'
    ? ADMIN_ROUTES
      .filter(
        (route) => canAccessAdminRoute(route, adminAccess),
      )
      .map((route) => ({
        ...route,
        path: adminPath(route.segment),
      }))
    : [], [adminAccess, user?.role])
  const items = useMemo(
    () => availableRoutes.filter((route) => route.showInNav),
    [availableRoutes],
  )
  const navigation = useMemo(
    () => buildAdminNavigation(ADMIN_NAVIGATION, ADMIN_ROUTES, adminAccess),
    [adminAccess],
  )
  const hasNoDepartment = (
    user?.role === 'admin'
    && !adminAccess.isSuperuser
    && adminAccess.memberships.length === 0
  )
  const currentRoute = [...availableRoutes]
    .sort((left, right) => right.path.length - left.path.length)
    .find((item) => {
      const staticPath = item.path.replace(/:[^/]+/g, '')
      return pathname === item.path || pathname.startsWith(staticPath)
    })
  const activeLeaf = findActiveAdminNavigation(navigation, pathname, search)
  const currentTitle = currentRoute?.segment.includes(':')
    ? currentRoute.title
    : activeLeaf?.label || currentRoute?.title
  useEffect(() => {
    mainRef.current?.focus({ preventScroll: true })
    setMobileNavOpen(false)
  }, [pathname])

  if (user?.role === 'employer') return <EmployerWorkspaceLayout />

  return (
    <ConfigProvider
      theme={{
        token: {
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
          width={280}
          collapsedWidth={80}
          collapsed={sidebarCollapsed}
          trigger={null}
          onMouseEnter={() => sidebarCollapsed && setSidebarPeek(true)}
          onFocusCapture={() => sidebarCollapsed && setSidebarPeek(true)}
        >
          {sidebarCollapsed && sidebarPeek ? (
            <div
              className="admin-sider__peek"
              onMouseLeave={() => setSidebarPeek(false)}
            >
              <AdminBrand />
              <AdminNavigation
                navigation={navigation}
                pathname={pathname}
                search={search}
                navigate={navigate}
              />
              {hasNoDepartment && (
                <p className="admin-sider__notice">
                  Tài khoản chưa được gán phòng ban. Liên hệ quản trị hệ thống
                  để được cấp quyền.
                </p>
              )}
            </div>
          ) : (
            <>
              <AdminBrand collapsed={sidebarCollapsed} />
              <AdminNavigation
                navigation={navigation}
                pathname={pathname}
                search={search}
                navigate={navigate}
                collapsed={sidebarCollapsed}
                onRequestExpand={() => setSidebarPeek(true)}
              />
              {hasNoDepartment && !sidebarCollapsed && (
                <p className="admin-sider__notice">
                  Tài khoản chưa được gán phòng ban. Liên hệ quản trị hệ thống
                  (superuser) để được cấp quyền.
                </p>
              )}
            </>
          )}
        </Sider>

        <Drawer
          open={mobileNavOpen}
          placement="left"
          size={320}
          closable={false}
          onClose={() => setMobileNavOpen(false)}
          styles={{ body: { padding: 0, background: '#0b172a' } }}
        >
          <div className="admin-sider min-h-full">
            <AdminBrand />
            <AdminNavigation
              navigation={navigation}
              pathname={pathname}
              search={search}
              navigate={navigate}
              mobile
              onNavigate={() => setMobileNavOpen(false)}
            />
            {hasNoDepartment && <p className="admin-sider__notice">Tài khoản chưa được gán phòng ban. Liên hệ quản trị hệ thống để được cấp quyền.</p>}
          </div>
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
                  {`Đang ở: ${currentTitle || 'Quản trị hệ thống'}`}
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
              <Popconfirm
                title="Đăng xuất khỏi phiên này?"
                description="Bạn sẽ cần đăng nhập lại để tiếp tục quản lý hệ thống."
                okText="Đăng xuất"
                cancelText="Ở lại"
                okButtonProps={{ danger: true }}
                onConfirm={logout}
                placement="bottomRight"
              >
                <Button
                  className="admin-icon-button"
                  icon={<LogoutOutlined />}
                  aria-label="Đăng xuất"
                  title="Đăng xuất"
                />
              </Popconfirm>
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
