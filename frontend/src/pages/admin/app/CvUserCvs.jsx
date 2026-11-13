import { SolutionOutlined } from '@ant-design/icons'
import { AdminCvShell } from '@/widgets/admin-cv-nav'
import { AdminCvUserCvs } from '@/widgets/admin-cv-user-cvs'

export default function AdminCvUserCvsPage() {
  return (
    <AdminCvShell title="CV ứng viên" description="Thông tin quản lý CV, không sửa nội dung của ứng viên." icon={<SolutionOutlined />}>
      <AdminCvUserCvs />
    </AdminCvShell>
  )
}
