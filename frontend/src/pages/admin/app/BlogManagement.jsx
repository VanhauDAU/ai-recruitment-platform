import { BlogContentManagement } from '@/features/manage-blog-content'
import { BlogTagManagement } from '@/features/manage-blog-tags'

export default function AdminBlogManagement() {
  return <BlogContentManagement tagPanel={<BlogTagManagement />} />
}
