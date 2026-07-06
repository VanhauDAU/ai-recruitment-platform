import { Layout, Menu, Button, Typography } from 'antd'
import { Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

const { Header, Sider, Content } = Layout

const NAV_ITEMS = {
  candidate: [
    { key: '/candidate/dashboard', label: 'Tổng quan' },
    { key: '/candidate/cvs', label: 'Kho CV' },
    { key: '/candidate/jobs', label: 'Việc làm' },
    { key: '/candidate/interviews', label: 'Luyện phỏng vấn' },
  ],
  employer: [
    { key: '/employer/dashboard', label: 'Tổng quan' },
    { key: '/employer/jobs', label: 'Tin tuyển dụng' },
    { key: '/employer/applications', label: 'Ứng viên' },
  ],
  admin: [
    { key: '/admin/dashboard', label: 'Tổng quan' },
    { key: '/admin/users', label: 'Người dùng' },
    { key: '/admin/skills', label: 'Kỹ năng' },
  ],
}

export default function DashboardLayout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const items = NAV_ITEMS[user?.role] || []

  return (
    <Layout className="min-h-screen">
      <Sider breakpoint="lg" collapsedWidth="0">
        <div className="text-white text-center py-4 font-semibold">AI Career Coach</div>
        <Menu
          theme="dark"
          mode="inline"
          items={items}
          onClick={({ key }) => navigate(key)}
        />
      </Sider>
      <Layout>
        <Header className="!bg-white flex items-center justify-end gap-4 border-b border-gray-200">
          <Typography.Text>{user?.email}</Typography.Text>
          <Button onClick={logout}>Đăng xuất</Button>
        </Header>
        <Content className="p-6">
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  )
}
