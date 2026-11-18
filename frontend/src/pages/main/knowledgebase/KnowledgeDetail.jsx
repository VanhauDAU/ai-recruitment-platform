import { useParams } from 'react-router'
import { PublicKnowledgeArticle } from '@/widgets/main/public-knowledgebase'

export default function KnowledgeDetail() {
  const { categorySlug, articleSlug } = useParams()
  return <PublicKnowledgeArticle categorySlug={categorySlug} articleSlug={articleSlug} />
}
