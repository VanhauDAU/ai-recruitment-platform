import { BlogContentManagement } from '@/features/admin/content/manage-blog-content'
import { BlogTagManagement } from '@/features/admin/content/manage-blog-tags'

export default function AdminBlogManagement() {
  return (
    <div className="space-y-5">
      <BlogContentManagement tagPanel={<BlogTagManagement />} />
    </div>
  )
}
