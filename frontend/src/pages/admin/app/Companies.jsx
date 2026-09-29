import { BankOutlined } from '@ant-design/icons'
import { AdminDataActions, AdminPageHeader } from '@/shared/ui/admin'
import { AdminCompanyWorkspace } from '@/widgets/admin-company-directory'

export default function Companies() {
  return (
    <div className="mx-auto max-w-[1600px] space-y-5">
      <AdminPageHeader
        eyebrow="Doanh nghiệp"
        title="Quản lý công ty"
        description="Tra cứu pháp nhân, theo dõi đội ngũ nhà tuyển dụng và xử lý các thay đổi trong một nơi."
        icon={<BankOutlined />}
        actions={<AdminDataActions allowExport={false} />}
      />
      <AdminCompanyWorkspace />
    </div>
  )
}
