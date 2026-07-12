import { Typography } from 'antd'
import { useSession } from '@/entities/session'

export default function AdminDashboard() {
  const { user } = useSession()
  return (
    <div>
      <Typography.Title level={3}>Xin chào Admin {user?.full_name || user?.email}</Typography.Title>
      <Typography.Paragraph>
        Quản lý người dùng, template CV, danh mục kỹ năng và tin tuyển dụng sẽ hiển thị ở đây.
      </Typography.Paragraph>
    </div>
  )
}
