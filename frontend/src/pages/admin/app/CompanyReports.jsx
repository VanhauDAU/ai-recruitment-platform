import { FlagOutlined } from '@ant-design/icons'
import { CompanyReportQueue } from '@/features/review-company-reports'
import { AdminPageHeader } from '@/shared/ui/admin'

export default function CompanyReports() {
  return (
    <div className="mx-auto max-w-[1600px] space-y-5">
      <AdminPageHeader
        eyebrow="Doanh nghiệp"
        title="Báo cáo công ty"
        icon={<FlagOutlined />}
      />
      <CompanyReportQueue />
    </div>
  )
}
