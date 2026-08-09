import { BookOutlined } from '@ant-design/icons'
import { AdminPageHeader } from '@/shared/ui/admin'
import { AdminKnowledgeBaseManagement } from '@/widgets/admin-knowledgebase-management'

export default function AdminKnowledgeBase() {
  return (
    <div className="space-y-5">
      <AdminPageHeader
        eyebrow="Nội dung đa cổng"
        title="Trung tâm FAQ & hướng dẫn"
        description="Biên tập, kiểm duyệt và giữ nội dung trợ giúp luôn chính xác trong một quy trình có lịch sử rõ ràng."
        icon={<BookOutlined />}
      />
      <AdminKnowledgeBaseManagement />
    </div>
  )
}
