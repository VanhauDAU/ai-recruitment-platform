import { Layout, Menu, Button, Typography } from 'antd'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import {
  canAccessAdminRoute,
  DepartmentBadge,
  useAdminAccess,
} from '@/entities/admin-access'
import { useSession } from '@/entities/session'
import { BrandLogo } from '@/entities/site-settings'
import { adminPath } from '@/shared/config/portals'
import { ADMIN_ROUTES } from '../router/admin/admin-routes.config'
import EmployerWorkspaceLayout from './EmployerWorkspaceLayout'

const { Header, Sider, Content } = Layout

export default function DashboardLayout() {
  const { user, logout } = useSession()
  const adminAccess = useAdminAccess(user)
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const items = user?.role === 'admin'
    ? ADMIN_ROUTES
      .filter(
        (route) => route.showInNav && canAccessAdminRoute(route, adminAccess),
      )
      .map((route) => ({
        key: adminPath(route.segment),
        label: route.navLabel,
      }))
    : []
  const hasNoDepartment = (
    user?.role === 'admin'
    && !adminAccess.isSuperuser
    && adminAccess.memberships.length === 0
  )

  if (user?.role === 'employer') return <EmployerWorkspaceLayout />

  return (
    <Layout className="min-h-screen">
      <Sider breakpoint="lg" collapsedWidth="0">
        <div className="flex justify-center px-4 py-4">
          <BrandLogo
            dark
            className="max-w-full justify-center"
            imageClassName="h-8 max-w-[168px]"
            textClassName="text-sm"
          />
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[pathname]}
          items={items}
          onClick={({ key }) => navigate(key)}
        />
        {hasNoDepartment && (
          <p className="mx-4 mt-4 rounded-lg bg-white/10 p-3 text-xs leading-5 text-slate-200">
            Tài khoản chưa được gán phòng ban. Liên hệ quản trị hệ thống
            (superuser) để được cấp quyền.
          </p>
        )}
      </Sider>
      <Layout>
        <Header className="!bg-white flex items-center justify-end gap-4 border-b border-gray-200">
          <div className="flex min-w-0 items-center gap-2">
            <DepartmentBadge
              primaryDepartment={adminAccess.primaryDepartment}
              memberships={adminAccess.memberships}
            />
            <Typography.Text ellipsis>{user?.email}</Typography.Text>
          </div>
          <Button onClick={logout}>Đăng xuất</Button>
        </Header>
        <Content className="p-6">
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  )
}
