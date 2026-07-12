import { Typography } from 'antd'
import { useAuth } from '@/features/auth'

export default function AdminDashboard() {
  const { user } = useAuth()
  return (
    <div>
      <Typography.Title level={3}>Xin chào Admin {user?.full_name || user?.email}</Typography.Title>
      <Typography.Paragraph>
        Quản lý người dùng, template CV, danh mục kỹ năng và tin tuyển dụng sẽ hiển thị ở đây.
      </Typography.Paragraph>
    </div>
  )
}
