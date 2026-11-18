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
import { groupApplicationsByCandidate } from './application-workspace'

export const PAGE_SIZE = 60

/** URL-driven state and server data of the applications workspace. */
export default function useApplicationWorkspace() {
  const [searchParams, setSearchParams] = useSearchParams()
  const queryClient = useQueryClient()
  const selectedPublicId = searchParams.get('application') || ''
  const [keyword, setKeyword] = useState(searchParams.get('q') || '')
  const [mobilePanel, setMobilePanel] = useState('cv')

  const listParams = useMemo(() => {
    const next = Object.fromEntries(searchParams)
    delete next.application
    next.page_size = PAGE_SIZE
    return next
  }, [searchParams])

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
    page: Math.max(1, Number.parseInt(searchParams.get('page') || '1', 10) || 1),
    setListFilter: (key, value) => updateParams((next) => {
      if (value) next.set(key, value)
      else next.delete(key)
      next.delete('application')
      next.delete('page')
    }),
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
