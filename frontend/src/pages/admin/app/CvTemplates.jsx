import { FileTextOutlined } from '@ant-design/icons'
import { AdminCvShell } from '@/widgets/admin-cv-nav'
import { AdminCvTemplates } from '@/widgets/admin-cv-templates'

export default function AdminCvTemplatesPage() {
  return (
    <AdminCvShell title="Mẫu CV" description="Tạo, chỉnh và sắp xếp mẫu ứng viên thấy trên kho mẫu." icon={<FileTextOutlined />}>
      <AdminCvTemplates />
    </AdminCvShell>
  )
}
