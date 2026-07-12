import { Typography } from 'antd'
import { useSession } from '@/entities/session'

export default function EmployerDashboard() {
  const { user } = useSession()
  return (
    <div>
      <Typography.Title level={3}>Chào {user?.full_name || user?.email}</Typography.Title>
      <Typography.Paragraph>
        Thống kê tin tuyển dụng, số hồ sơ ứng tuyển và ứng viên phù hợp nhất sẽ hiển thị ở đây.
      </Typography.Paragraph>
    </div>
  )
}
