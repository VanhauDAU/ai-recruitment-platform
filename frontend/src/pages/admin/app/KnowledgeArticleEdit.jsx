import { useParams } from 'react-router'
import { AdminKnowledgeArticleWorkspace } from '@/widgets/admin-knowledgebase-management'

export default function AdminKnowledgeArticleEdit() {
  const { publicId } = useParams()
  return <AdminKnowledgeArticleWorkspace publicId={publicId} />
}
