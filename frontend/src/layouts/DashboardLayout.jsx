import { Layout, Menu, Button, Typography } from 'antd'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { EmailVerificationBanner, useAuth } from '@/features/auth'
import BrandLogo from '../components/brand/BrandLogo'
import { adminPath, employerAppPath } from '../config/portals'

const { Header, Sider, Content } = Layout

const NAV_ITEMS = {
  employer: [
    { key: employerAppPath('/dashboard'), label: 'Tổng quan' },
    { key: employerAppPath('/jobs'), label: 'Tin tuyển dụng' },
    { key: employerAppPath('/applications'), label: 'Ứng viên' },
  ],
  admin: [
    { key: adminPath('/dashboard'), label: 'Tổng quan' },
    { key: adminPath('/settings'), label: 'Cài đặt hệ thống' },
  ],
}

export default function DashboardLayout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const items = NAV_ITEMS[user?.role] || []

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
      </Sider>
      <Layout>
        <Header className="!bg-white flex items-center justify-end gap-4 border-b border-gray-200">
          <Typography.Text>{user?.email}</Typography.Text>
          <Button onClick={logout}>Đăng xuất</Button>
        </Header>
        {user?.role === 'employer' && (
          <EmailVerificationBanner verificationPath={employerAppPath('/xac-thuc-email')} />
        )}
        <Content className="p-6">
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  )
}
