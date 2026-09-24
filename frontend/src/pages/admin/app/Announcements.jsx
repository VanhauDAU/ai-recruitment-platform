import { NotificationOutlined } from '@ant-design/icons'
import { AdminPageHeader } from '@/shared/ui/admin'
import { AdminAnnouncementManagement } from '@/widgets/admin-announcement-management'

export default function Announcements() {
  return (
    <div className="mx-auto max-w-[1700px] space-y-5">
      <AdminPageHeader
        eyebrow="Nội dung đa cổng"
        title="Trung tâm thông báo"
        description="Soạn nội dung, mô phỏng ưu tiên, lên lịch và kiểm soát vòng đời dải thông báo trên ứng viên, nhà tuyển dụng và quản trị."
        icon={<NotificationOutlined />}
      />
      <AdminAnnouncementManagement />
    </div>
  )
}
