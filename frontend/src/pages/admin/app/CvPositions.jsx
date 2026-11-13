import { ApartmentOutlined } from '@ant-design/icons'
import { AdminCvShell } from '@/widgets/admin-cv-nav'
import { AdminCvPositions } from '@/widgets/admin-cv-positions'

export default function AdminCvPositionsPage() {
  return (
    <AdminCvShell title="Nội dung theo vị trí" description="Khi tạo CV, ứng viên chọn vị trí và số năm kinh nghiệm. Mỗi vị trí có các mục, câu hỏi riêng của nghề và nội dung gợi ý; vị trí chưa có bản riêng dùng nội dung chung." icon={<ApartmentOutlined />}>
      <AdminCvPositions />
    </AdminCvShell>
  )
}
