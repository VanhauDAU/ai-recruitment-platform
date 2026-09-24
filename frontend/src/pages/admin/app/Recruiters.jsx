import { IdcardOutlined } from '@ant-design/icons'
import { AdminDataActions, AdminPageHeader } from '@/shared/ui/admin'
import { AdminAccountManagement } from '@/widgets/admin-account-management'

export default function Recruiters() {
  return (
    <div className="space-y-5">
      <AdminPageHeader
        eyebrow="Doanh nghiệp"
        title="Nhà tuyển dụng"
        description="Tra cứu tài khoản NTD và xử lý hồ sơ xác thực đại diện doanh nghiệp."
        icon={<IdcardOutlined />}
        actions={<AdminDataActions allowExport={false} />}
      />
      <AdminAccountManagement scope="recruiters" />
    </div>
  )
}
