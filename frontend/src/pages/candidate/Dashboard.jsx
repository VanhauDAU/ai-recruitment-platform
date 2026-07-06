import { Typography } from 'antd'
import { useAuth } from '../../hooks/useAuth'

export default function CandidateDashboard() {
  const { user } = useAuth()
  return (
    <div>
      <Typography.Title level={3}>Chào {user?.full_name || user?.email}</Typography.Title>
      <Typography.Paragraph>
        Tổng quan CV, việc làm đã ứng tuyển, điểm phù hợp và luyện phỏng vấn sẽ hiển thị ở đây.
      </Typography.Paragraph>
    </div>
  )
}
