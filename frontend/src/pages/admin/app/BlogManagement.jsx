import { FileTextOutlined } from '@ant-design/icons'
import { BlogContentManagement } from '@/features/manage-blog-content'
import { BlogTagManagement } from '@/features/manage-blog-tags'
import { AdminPageHeader } from '@/shared/ui/admin'

export default function AdminBlogManagement() {
  return (
    <div className="space-y-5">
      <AdminPageHeader
        eyebrow="Nội dung đa cổng"
        title="Cẩm nang nghề nghiệp"
        description="Biên tập, kiểm duyệt và tổ chức nội dung hiển thị cho ứng viên trong một quy trình có lịch sử rõ ràng."
        icon={<FileTextOutlined />}
      />
      <BlogContentManagement tagPanel={<BlogTagManagement />} />
    </div>
  )
}
