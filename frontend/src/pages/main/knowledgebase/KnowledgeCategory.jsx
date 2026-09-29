import { useParams } from 'react-router'
import { PublicKnowledgeBrowser } from '@/widgets/public-knowledgebase'

export default function KnowledgeCategory() {
  const { categorySlug } = useParams()
  return <PublicKnowledgeBrowser categorySlug={categorySlug} />
}
