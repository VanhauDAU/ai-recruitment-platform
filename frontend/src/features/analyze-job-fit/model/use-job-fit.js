import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { getMySavedCvs } from '@/entities/cv'
import { getJobFit, listJobFits, requestJobFit } from '../api/job-fit.api'
import { isAnalysisActive } from './job-fit'

const POLL_INTERVAL_MS = 800
const analysisKey = (publicId) => ['job-fit', 'analysis', publicId]

// Trạng thái của hộp thoại xem độ phù hợp: danh sách CV, kết quả gần nhất của
// tin, yêu cầu phân tích và poll tới khi backend trả kết quả.
export function useJobFit(jobSlug) {
  const queryClient = useQueryClient()
  const [publicId, setPublicId] = useState(null)
  const cvsQuery = useQuery({ queryKey: ['job-fit', 'cvs'], queryFn: getMySavedCvs })
  const recentQuery = useQuery({
    queryKey: ['job-fit', 'recent', jobSlug],
    queryFn: () => listJobFits(jobSlug),
  })
  const shownId = publicId || recentQuery.data?.find((item) => item.status === 'succeeded')?.public_id
  const analysisQuery = useQuery({
    queryKey: analysisKey(shownId),
    queryFn: () => getJobFit(shownId),
    enabled: Boolean(shownId),
    initialData: () => recentQuery.data?.find((item) => item.public_id === shownId),
    refetchInterval: (query) => (isAnalysisActive(query.state.data) ? POLL_INTERVAL_MS : false),
  })
  const request = useMutation({
    mutationFn: (cvPublicId) => requestJobFit({ jobSlug, cvPublicId }),
    onSuccess: (analysis) => {
      queryClient.setQueryData(analysisKey(analysis.public_id), analysis)
      setPublicId(analysis.public_id)
      queryClient.invalidateQueries({ queryKey: ['job-fit', 'recent', jobSlug] })
    },
  })

  return {
    cvs: cvsQuery.data || [],
    cvsLoading: cvsQuery.isLoading,
    analysis: analysisQuery.data || null,
    isFromEarlier: !publicId && Boolean(shownId),
    analyze: request.mutate,
    requesting: request.isPending,
    requestError: request.error,
  }
}
