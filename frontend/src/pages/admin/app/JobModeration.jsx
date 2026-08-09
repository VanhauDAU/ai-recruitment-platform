import { FileDoneOutlined } from '@ant-design/icons'
import { AdminPageHeader } from '@/shared/ui/admin'
import { AdminJobManagement } from '@/widgets/admin-job-management'

export default function JobModeration() {
  return (
    <div className="space-y-5">
      <AdminPageHeader
        eyebrow="Tuyển dụng & CV"
        title="Quản lý tin tuyển dụng"
        description="Kiểm duyệt nội dung, theo dõi trạng thái hiển thị và xử lý báo cáo vi phạm của tin tuyển dụng."
        icon={<FileDoneOutlined />}
      />
      <AdminJobManagement />
    </div>
  )
}
