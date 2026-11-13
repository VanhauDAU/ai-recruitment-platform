import { FileDoneOutlined } from '@ant-design/icons'
import { AdminPageHeader } from '@/shared/ui/admin'
import { AdminJobManagement } from '@/widgets/admin-job-management'

export default function JobModeration() {
  return (
    <div className="space-y-5">
      <AdminPageHeader
        eyebrow="Tuyển dụng & CV"
        title="Quản lý tin tuyển dụng"
        description="Hậu kiểm tin đã đăng: theo dõi trạng thái hiển thị, xử lý báo cáo vi phạm và tạm ẩn tin khi cần."
        icon={<FileDoneOutlined />}
      />
      <AdminJobManagement />
    </div>
  )
}
