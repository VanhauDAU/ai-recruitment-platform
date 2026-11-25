import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { getCandidateJobRecommendations, jobKeys } from '@/entities/job/job'
import { useHideJobRecommendation } from '@/features/main/job/hide-job-recommendation'
import { useHomeRecommendationQuery } from '../model/use-home-recommendation-summary'
import AccountRecommendations from './AccountRecommendations'
import HomeRecommendations from './HomeRecommendations'

const ACCOUNT_PAGE_SIZE = 10

export default function CandidateJobRecommendations({ variant = 'account' }) {
  return variant === 'home' ? <HomeVariant /> : <AccountVariant />
}

function HomeVariant() {
  // Trang chủ không chờ ứng viên khai nhu cầu: khi gợi ý theo CV bật, CV đã lưu là đủ.
  const { enabled, query } = useHomeRecommendationQuery()
  const hidden = useHideJobRecommendation()
  if (!enabled) return null
  return <HomeRecommendations data={query.data} query={query} {...hidden} />
}

function AccountVariant() {
  const [page, setPage] = useState(1)
  const params = useMemo(() => ({ page, page_size: ACCOUNT_PAGE_SIZE }), [page])
  const query = useQuery({
    queryKey: jobKeys.candidateRecommendations(params),
    queryFn: () => getCandidateJobRecommendations(params),
    placeholderData: keepPreviousData,
    retry: 1,
  })
  const hidden = useHideJobRecommendation()
  return (
    <AccountRecommendations
      data={query.data}
      page={page}
      query={query}
      setPage={setPage}
      {...hidden}
    />
  )
}
