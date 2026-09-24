import { JobComparisonWorkspace } from '@/features/compare-jobs'
import { useDocumentMetadata } from '@/shared/hooks/use-document-metadata'

export default function JobComparison() {
  useDocumentMetadata({
    title: 'So sánh việc làm',
    description: 'Đối chiếu mức lương, yêu cầu, phúc lợi và thông tin công ty của các việc làm bạn quan tâm.',
    canonicalPath: '/so-sanh-viec-lam',
    robots: 'noindex, nofollow',
  })
  return <JobComparisonWorkspace />
}
