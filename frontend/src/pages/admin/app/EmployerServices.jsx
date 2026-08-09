import { SolutionOutlined } from '@ant-design/icons'
import { AdminPageHeader } from '@/shared/ui/admin'
import { AdminServiceCatalog } from '@/widgets/admin-service-catalog'

export default function AdminEmployerServices() {
  return (
    <div className="space-y-5">
      <AdminPageHeader
        eyebrow="Nội dung & dịch vụ"
        title="Dịch vụ nhà tuyển dụng"
        description="Quản lý danh mục, gói dịch vụ, giá và trạng thái hiển thị trên cổng nhà tuyển dụng."
        icon={<SolutionOutlined />}
      />
      <AdminServiceCatalog />
    </div>
  )
}
