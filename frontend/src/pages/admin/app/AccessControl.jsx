import { SafetyCertificateOutlined } from '@ant-design/icons'
import { AdminDataActions, AdminPageHeader } from '@/shared/ui/admin'
import { AdminAccessControl } from '@/widgets/admin-access-control'

export default function AccessControl() {
  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <AdminPageHeader
        eyebrow="Hệ thống"
        title="Phân quyền quản trị"
        description="Quản lý phòng ban, chức danh, quyền hiệu lực và phạm vi cấp tài khoản quản trị."
        icon={<SafetyCertificateOutlined />}
        actions={<AdminDataActions allowExport={false} />}
      />
      <AdminAccessControl />
    </div>
  )
}
