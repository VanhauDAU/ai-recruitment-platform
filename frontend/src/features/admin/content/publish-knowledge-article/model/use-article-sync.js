import { useQueryClient } from '@tanstack/react-query'
import { adminKnowledgeKeys } from '@/entities/content/knowledgebase'

/** Đẩy bài vừa ghi vào cache chi tiết và làm mới danh sách/KPI. */
export default function useArticleSync(onArticleChange) {
  const queryClient = useQueryClient()
  return (saved) => {
    onArticleChange?.(saved)
    queryClient.setQueryData(adminKnowledgeKeys.article(saved.public_id), saved)
    queryClient.invalidateQueries({ queryKey: adminKnowledgeKeys.root })
  }
}
