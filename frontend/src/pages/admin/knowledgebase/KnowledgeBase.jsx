import { BookOutlined } from '@ant-design/icons'
import { AdminPageHeader } from '@/shared/ui/admin'
import { AdminKnowledgeBaseManagement } from '@/widgets/admin/knowledgebase-management'

export default function AdminKnowledgeBase() {
  return (
    <div className="space-y-5">
      <AdminPageHeader
        eyebrow="Nội dung đa cổng"
        title="Trung tâm FAQ & hướng dẫn"
        description="Soạn, xuất bản và rà soát định kỳ để nội dung trợ giúp luôn chính xác, có lịch sử phiên bản rõ ràng."
        icon={<BookOutlined />}
      />
      <AdminKnowledgeBaseManagement />
    </div>
  )
}
