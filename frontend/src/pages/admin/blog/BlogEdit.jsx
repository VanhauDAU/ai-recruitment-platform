import { useParams } from 'react-router'
import { BlogPostEditor } from '@/features/admin/content/edit-blog-post'

export default function AdminBlogEdit() {
  const { publicId } = useParams()
  return <BlogPostEditor publicId={publicId} />
}
