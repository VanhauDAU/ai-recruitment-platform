import { BgColorsOutlined } from '@ant-design/icons'
import { AdminCvShell } from '@/widgets/admin-cv-nav'
import { AdminCvLibrary } from '@/widgets/admin-cv-library'

export default function AdminCvLibraryPage() {
  return (
    <AdminCvShell title="Thư viện" description="Màu, danh mục, hình nền dùng chung cho mọi mẫu." icon={<BgColorsOutlined />}>
      <AdminCvLibrary />
    </AdminCvShell>
  )
}
