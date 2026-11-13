import { FileTextOutlined } from '@ant-design/icons'
import { AdminPageHeader } from '@/shared/ui/admin'
import { AdminCvCatalogue } from '@/widgets/admin-cv-catalogue'

export default function AdminCvCataloguePage() {
  return (
    <div className="space-y-5">
      <AdminPageHeader
        eyebrow="Tuyển dụng & CV"
        title="Catalogue CV"
        description="Quản lý mẫu, nội dung mẫu, blueprint, ngôn ngữ, taxonomy và hình nền của hệ thống CV."
        icon={<FileTextOutlined />}
      />
      <AdminCvCatalogue />
    </div>
  )
}
