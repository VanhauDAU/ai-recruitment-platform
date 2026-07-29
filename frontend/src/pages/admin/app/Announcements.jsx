import { AdminAnnouncementManagement } from '@/widgets/admin-announcement-management'

export default function Announcements() {
  return (
    <div className="mx-auto max-w-[1700px] space-y-5">
      <header className="admin-page-header">
        <div>
          <p className="admin-page-header__eyebrow">Nội dung đa cổng</p>
          <h1 className="admin-page-header__title">Trung tâm thông báo</h1>
          <p className="admin-page-header__description">
            Soạn nội dung, mô phỏng ưu tiên, lên lịch và kiểm soát vòng đời dải
            thông báo trên ứng viên, nhà tuyển dụng và quản trị.
          </p>
        </div>
      </header>
      <AdminAnnouncementManagement />
    </div>
  )
}
