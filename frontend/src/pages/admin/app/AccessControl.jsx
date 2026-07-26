import { SafetyCertificateOutlined } from '@ant-design/icons'
import { AdminAccessControl } from '@/widgets/admin-access-control'
import { AdminPageHeader } from '@/widgets/admin-workspace'

export default function AccessControl() {
  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <AdminPageHeader
        eyebrow="Bảo mật & tổ chức"
        title="Phân quyền quản trị"
        description="Quản lý phòng ban, chức danh và quyền truy cập. Mọi thay đổi đều được ghi audit."
        icon={<SafetyCertificateOutlined />}
      />
      <AdminAccessControl />
    </div>
  )
}
