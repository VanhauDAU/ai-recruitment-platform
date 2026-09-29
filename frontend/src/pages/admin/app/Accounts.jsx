import { TeamOutlined } from '@ant-design/icons'
import { AdminDataActions, AdminPageHeader } from '@/shared/ui/admin'
import { AdminAccountManagement } from '@/widgets/admin-account-management'

export default function Accounts() {
  return (
    <div className="account-page mx-auto max-w-[1500px] space-y-5">
      <AdminPageHeader
        eyebrow="Người dùng"
        title="Tài khoản người dùng"
        description="Quản lý ứng viên, quản trị viên và vòng đời lời mời quản trị. Nhà tuyển dụng được quản lý riêng trong khu vực Doanh nghiệp."
        icon={<TeamOutlined />}
        actions={<AdminDataActions allowExport={false} />}
      />
      <AdminAccountManagement />
    </div>
  )
}
