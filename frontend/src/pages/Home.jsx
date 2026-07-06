import { Button, Typography } from 'antd'
import { Link } from 'react-router-dom'

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-gray-50 text-center px-4">
      <Typography.Title>AI Career Coach</Typography.Title>
      <Typography.Paragraph className="max-w-xl">
        Tạo CV chuyên nghiệp, phân tích CV bằng AI, so khớp với tin tuyển dụng và luyện phỏng vấn thông minh.
      </Typography.Paragraph>
      <div className="flex gap-3">
        <Link to="/login"><Button type="primary">Đăng nhập</Button></Link>
        <Link to="/register"><Button>Đăng ký</Button></Link>
      </div>
    </div>
  )
}
