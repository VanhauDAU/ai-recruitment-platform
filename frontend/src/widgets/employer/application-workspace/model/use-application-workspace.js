import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router'
import {
  applicationKeys,
  getApplicationHistory,
  getRecruiterApplicationPage,
  getRecruiterApplicationSnapshot,
  replaceApplicationInPage,
} from '@/entities/application/application'
import { getEmployerJobPage, jobKeys } from '@/entities/job/job'
import { useSiteSettings } from '@/entities/system/site-settings'
import { groupApplicationsByCandidate } from './application-workspace'

const PAGE_SIZE = 60
// Mọi tin của nhà tuyển dụng (kể cả đã đóng) vì hồ sơ cũ vẫn thuộc về chúng.
const JOB_OPTION_PARAMS = { page_size: 100 }

/** URL-driven state and server data of the applications workspace. */
export default function useApplicationWorkspace() {
  const [searchParams, setSearchParams] = useSearchParams()
  const queryClient = useQueryClient()
  const selectedPublicId = searchParams.get('application') || ''
  const [keyword, setKeyword] = useState(searchParams.get('q') || '')
  const [mobilePanel, setMobilePanel] = useState('cv')
  const rankingEnabled = useSiteSettings().settings.ai_application_ranking_enabled === true

  const listParams = useMemo(() => {
    const next = Object.fromEntries(searchParams)
    delete next.application
    // "Phù hợp nhất" đã lưu trong URL không còn hiệu lực khi tính năng tắt.
    if (next.ordering === 'ai_match' && !rankingEnabled) delete next.ordering
    next.page_size = PAGE_SIZE
    return next
  }, [rankingEnabled, searchParams])
  const jobsQuery = useQuery({
    queryKey: jobKeys.employerList(JOB_OPTION_PARAMS),
    queryFn: () => getEmployerJobPage(JOB_OPTION_PARAMS),
    staleTime: 60_000,
  })
  const jobOptions = useMemo(
    () => (jobsQuery.data?.results || []).map((job) => ({ value: job.public_id, label: job.title })),
    [jobsQuery.data],
  )

  const listQuery = useQuery({
    queryKey: applicationKeys.recruiterList(listParams),
    queryFn: () => getRecruiterApplicationPage(listParams),
  })
  const applications = useMemo(() => listQuery.data?.results || [], [listQuery.data])
  const groups = useMemo(() => groupApplicationsByCandidate(applications), [applications])
  const selectedApplication = applications.find((item) => item.public_id === selectedPublicId)

  // The snapshot is immutable and every fetch is audited (and may mark the
  // application viewed), so it is never refetched in the background.
  const snapshotQuery = useQuery({
    queryKey: applicationKeys.recruiterSnapshot(selectedPublicId),
    queryFn: () => getRecruiterApplicationSnapshot(selectedPublicId),
    enabled: Boolean(selectedPublicId),
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  })
  const historyQuery = useQuery({
    queryKey: applicationKeys.history(selectedPublicId),
    queryFn: () => getApplicationHistory(selectedPublicId),
    enabled: Boolean(selectedPublicId),
  })

  useEffect(() => {
    setKeyword(searchParams.get('q') || '')
  }, [searchParams])

  // Opening a new CV marks it viewed server-side: mirror that locally
  // instead of refetching the whole list.
  const snapshotStatus = snapshotQuery.data?.status
  useEffect(() => {
    if (snapshotStatus !== 'viewed' || !selectedPublicId) return
    let changed = false
    queryClient.setQueriesData({ queryKey: applicationKeys.recruiterLists() }, (page) => {
      const item = page?.results?.find((row) => row.public_id === selectedPublicId)
      if (item?.status !== 'submitted') return page
      changed = true
      return replaceApplicationInPage(page, { public_id: selectedPublicId, status: 'viewed' })
    })
    if (!changed) return
    queryClient.invalidateQueries({ queryKey: applicationKeys.history(selectedPublicId) })
    queryClient.invalidateQueries({ queryKey: applicationKeys.recruiterUnreadCount() })
  }, [queryClient, selectedPublicId, snapshotStatus])

  useEffect(() => {
    if (listQuery.isLoading || selectedPublicId || applications.length === 0) return
    const next = new URLSearchParams(searchParams)
    next.set('application', applications[0].public_id)
    setSearchParams(next, { replace: true })
  }, [applications, listQuery.isLoading, searchParams, selectedPublicId, setSearchParams])

  function updateParams(mutate) {
    const next = new URLSearchParams(searchParams)
    mutate(next)
    setSearchParams(next, { replace: true })
  }

  return {
    groups,
    applicationCount: listQuery.data?.count || 0,
    pageSize: PAGE_SIZE,
    listQuery,
    snapshotQuery,
    historyQuery,
    selectedPublicId,
    selectedApplication,
    keyword,
    setKeyword,
    mobilePanel,
    setMobilePanel,
    statusFilter: searchParams.get('status') || '',
    scopeFilter: searchParams.get('scope') || '',
    jobFilter: searchParams.get('job') || '',
    ordering: listParams.ordering || 'newest',
    rankingEnabled,
    jobOptions,
    jobOptionsLoading: jobsQuery.isPending,
    hasFilters: ['q', 'status', 'scope', 'job', 'campaign'].some((key) => searchParams.get(key)),
    page: Math.max(1, Number.parseInt(searchParams.get('page') || '1', 10) || 1),
    /** Sets list params (`{ status: 'viewed', scope: '' }`) and starts again at page 1. */
    setListFilters: (values) => updateParams((next) => {
      Object.entries(values).forEach(([key, value]) => {
        if (value) next.set(key, value)
        else next.delete(key)
      })
      next.delete('application')
      next.delete('page')
    }),
    clearFilters: () => {
      setKeyword('')
      updateParams((next) => {
        ['q', 'status', 'scope', 'job', 'campaign', 'application', 'page'].forEach((key) => next.delete(key))
      })
    },
    changePage: (nextPage) => updateParams((next) => {
      if (nextPage > 1) next.set('page', String(nextPage))
      else next.delete('page')
      next.delete('application')
    }),
    selectApplication: (application) => {
      if (application.public_id === selectedPublicId) return
      setMobilePanel('cv')
      updateParams((next) => next.set('application', application.public_id))
    },
  }
}
