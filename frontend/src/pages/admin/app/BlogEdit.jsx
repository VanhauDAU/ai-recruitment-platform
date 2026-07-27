import { useParams } from 'react-router'
import { BlogPostEditor } from '@/features/edit-blog-post'

export default function AdminBlogEdit() {
  const { publicId } = useParams()
  return <BlogPostEditor publicId={publicId} />
}
