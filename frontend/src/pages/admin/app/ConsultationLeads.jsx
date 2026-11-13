import { ContactsOutlined } from '@ant-design/icons'
import { AdminPageHeader } from '@/shared/ui/admin'
import { AdminConsultationLeads } from '@/widgets/admin-consultation-leads'

export default function AdminConsultationLeadsPage() {
  return (
    <div className="space-y-5">
      <AdminPageHeader
        eyebrow="Nội dung & dịch vụ"
        title="Yêu cầu tư vấn"
        description="Theo dõi nhu cầu của khách hàng doanh nghiệp và trạng thái liên hệ của đội ngũ tư vấn."
        icon={<ContactsOutlined />}
      />
      <AdminConsultationLeads />
    </div>
  )
}
