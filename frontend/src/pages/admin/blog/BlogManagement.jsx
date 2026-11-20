import { FileTextOutlined } from '@ant-design/icons'
import { BlogContentManagement } from '@/features/admin/content/manage-blog-content'
import { BlogTagManagement } from '@/features/admin/content/manage-blog-tags'
import { AdminPageHeader } from '@/shared/ui/admin'

export default function AdminBlogManagement() {
  return (
    <div className="space-y-5">
      <AdminPageHeader
        eyebrow="Nội dung đa cổng"
        title="Cẩm nang nghề nghiệp"
        description="Soạn, xuất bản và tổ chức nội dung hiển thị cho ứng viên, có lịch sử thay đổi rõ ràng."
        icon={<FileTextOutlined />}
      />
      <BlogContentManagement tagPanel={<BlogTagManagement />} />
    </div>
  )
}
