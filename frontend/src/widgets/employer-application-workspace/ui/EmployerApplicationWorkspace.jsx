import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router'
import {
  applicationKeys,
  getApplicationHistory,
  getRecruiterApplicationPage,
  getRecruiterApplicationSnapshot,
  RECRUITER_APPLICATION_STATUSES,
  updateApplicationStatus,
} from '@/entities/application'
import { getApiErrorMessage } from '@/shared/api/error-mapper'
import { message } from '@/shared/lib/toast'
import { groupApplicationsByCandidate } from '../model/application-workspace'
import ApplicationCandidateList from './ApplicationCandidateList'
import ApplicationCvPreview from './ApplicationCvPreview'
import ApplicationInspectorPanel from './ApplicationInspectorPanel'

const PAGE_SIZE = 60

function updateApplicationInPage(pageData, application) {
  if (!pageData) return pageData
  if (Array.isArray(pageData)) {
    return pageData.map((item) => item.public_id === application.public_id ? application : item)
  }
  return {
    ...pageData,
    results: (pageData.results || []).map((item) => (
      item.public_id === application.public_id ? application : item
    )),
  }
}

export default function EmployerApplicationWorkspace() {
  const [searchParams, setSearchParams] = useSearchParams()
  const selectedPublicId = searchParams.get('application') || ''
  const [keywordInput, setKeywordInput] = useState(searchParams.get('q') || '')
  const [mobilePanel, setMobilePanel] = useState('cv')
  const [employerNote, setEmployerNote] = useState('')
  const [employerRating, setEmployerRating] = useState(null)
  const [assessmentDirty, setAssessmentDirty] = useState(false)
  const queryClient = useQueryClient()

  const listParams = useMemo(() => {
    const next = Object.fromEntries(searchParams)
    delete next.application
    next.page_size = PAGE_SIZE
    return next
  }, [searchParams])
  const page = Math.max(1, Number.parseInt(searchParams.get('page') || '1', 10) || 1)
  const statusFilter = searchParams.get('status') || ''

  const applicationsQuery = useQuery({
    queryKey: applicationKeys.recruiterList(listParams),
    queryFn: () => getRecruiterApplicationPage(listParams),
  })
  const applications = useMemo(() => {
    const data = applicationsQuery.data
    if (!data) return []
    return Array.isArray(data) ? data : (data.results || [])
  }, [applicationsQuery.data])
  const pageData = applicationsQuery.data
  const applicationCount = Array.isArray(pageData) ? pageData.length : (pageData?.count || 0)
  const groups = useMemo(() => groupApplicationsByCandidate(applications), [applications])
  const selectedApplication = applications.find((item) => item.public_id === selectedPublicId)

  const snapshotQuery = useQuery({
    queryKey: applicationKeys.recruiterSnapshot(selectedPublicId),
    queryFn: () => getRecruiterApplicationSnapshot(selectedPublicId),
    enabled: Boolean(selectedPublicId),
  })
  const historyQuery = useQuery({
    queryKey: applicationKeys.history(selectedPublicId),
    queryFn: () => getApplicationHistory(selectedPublicId),
    enabled: Boolean(selectedPublicId),
  })
  const currentStatus = snapshotQuery.data?.status ?? selectedApplication?.status

  useEffect(() => {
    setKeywordInput(searchParams.get('q') || '')
  }, [searchParams])

  useEffect(() => {
    if (!snapshotQuery.dataUpdatedAt) return
    queryClient.invalidateQueries({ queryKey: ['applications', 'recruiter-list'] })
  }, [queryClient, snapshotQuery.dataUpdatedAt])

  useEffect(() => {
    if (assessmentDirty) return
    setEmployerNote(selectedApplication?.employer_note || '')
    setEmployerRating(selectedApplication?.employer_rating || null)
  }, [assessmentDirty, selectedApplication, selectedPublicId])

  useEffect(() => {
    if (applicationsQuery.isLoading || selectedPublicId || applications.length === 0) return
    const next = new URLSearchParams(searchParams)
    next.set('application', applications[0].public_id)
    setSearchParams(next, { replace: true })
  }, [applications, applicationsQuery.isLoading, searchParams, selectedPublicId, setSearchParams])

  const updateMutation = useMutation({
    mutationFn: ({ publicId, payload }) => updateApplicationStatus(publicId, payload),
    onSuccess: (application, variables) => {
      queryClient.setQueriesData(
        { queryKey: ['applications', 'recruiter-list'] },
        (data) => updateApplicationInPage(data, application),
      )
      queryClient.setQueryData(
        applicationKeys.recruiterSnapshot(application.public_id),
        (snapshot) => snapshot ? { ...snapshot, status: application.status } : snapshot,
      )
      queryClient.invalidateQueries({ queryKey: ['applications', 'recruiter-list'] })
      queryClient.invalidateQueries({ queryKey: applicationKeys.history(application.public_id) })
      queryClient.invalidateQueries({ queryKey: applicationKeys.recruiterSnapshot(application.public_id) })
      if (variables.kind === 'assessment') setAssessmentDirty(false)
      message.success(variables.kind === 'assessment' ? 'Đã lưu đánh giá nội bộ.' : 'Đã cập nhật trạng thái hồ sơ.')
    },
    onError: (error) => message.error(
      getApiErrorMessage(error, 'Không thể cập nhật hồ sơ với lựa chọn này.'),
    ),
  })

  function setListFilter(key, value) {
    const next = new URLSearchParams(searchParams)
    if (value) next.set(key, value)
    else next.delete(key)
    next.delete('application')
    next.delete('page')
    setAssessmentDirty(false)
    setSearchParams(next, { replace: true })
  }

  function selectApplication(application) {
    if (application.public_id === selectedPublicId) return
    const next = new URLSearchParams(searchParams)
    next.set('application', application.public_id)
    setAssessmentDirty(false)
    setMobilePanel('cv')
    setSearchParams(next, { replace: true })
  }

  function changePage(nextPage) {
    const next = new URLSearchParams(searchParams)
    if (nextPage > 1) next.set('page', String(nextPage))
    else next.delete('page')
    next.delete('application')
    setAssessmentDirty(false)
    setSearchParams(next, { replace: true })
  }

  function changeStatus(status) {
    if (!selectedPublicId || status === currentStatus) return
    updateMutation.mutate({
      publicId: selectedPublicId,
      payload: { status },
      kind: 'status',
    })
  }

  function saveAssessment() {
    if (!selectedPublicId || !currentStatus) return
    updateMutation.mutate({
      publicId: selectedPublicId,
      payload: {
        status: currentStatus,
        employer_note: employerNote,
        employer_rating: employerRating || null,
      },
      kind: 'assessment',
    })
  }

  return (
    <section className="space-y-4 pb-5 pt-3">

      <div className="grid min-w-0 gap-4 md:grid-cols-3 xl:h-[calc(100dvh-10rem)] xl:min-h-96 xl:grid-cols-12">
        <ApplicationCandidateList
          groups={groups}
          applicationCount={applicationCount}
          selectedPublicId={selectedPublicId}
          keyword={keywordInput}
          status={statusFilter}
          page={page}
          pageSize={PAGE_SIZE}
          loading={applicationsQuery.isLoading}
          error={applicationsQuery.error}
          onKeywordChange={setKeywordInput}
          onKeywordSubmit={(value) => setListFilter('q', value.trim())}
          onStatusChange={(value) => setListFilter('status', value)}
          onPageChange={changePage}
          onRetry={() => applicationsQuery.refetch()}
          onSelect={selectApplication}
        />
        {selectedPublicId && (
          <div role="tablist" aria-label="Nội dung hồ sơ trên thiết bị di động" className="grid grid-cols-2 gap-1 rounded-xl border border-slate-200 bg-white p-1 shadow-sm md:hidden">
            <button
              type="button"
              role="tab"
              aria-selected={mobilePanel === 'cv'}
              className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${mobilePanel === 'cv' ? 'bg-slate-900 text-white' : 'text-slate-500'}`}
              onClick={() => setMobilePanel('cv')}
            >
              Xem trước CV
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mobilePanel === 'info'}
              className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${mobilePanel === 'info' ? 'bg-slate-900 text-white' : 'text-slate-500'}`}
              onClick={() => setMobilePanel('info')}
            >
              Thông tin liên quan
            </button>
          </div>
        )}
        <ApplicationCvPreview
          className={mobilePanel === 'cv' ? '' : 'max-md:hidden'}
          selectedApplication={selectedApplication}
          selectedPublicId={selectedPublicId}
          snapshot={snapshotQuery.data}
          loading={snapshotQuery.isLoading}
          error={snapshotQuery.error}
          onRetry={() => snapshotQuery.refetch()}
        />
        <ApplicationInspectorPanel
          className={mobilePanel === 'info' ? '' : 'max-md:hidden'}
          selectedApplication={selectedApplication}
          selectedPublicId={selectedPublicId}
          snapshot={snapshotQuery.data}
          currentStatus={currentStatus}
          statuses={RECRUITER_APPLICATION_STATUSES}
          employerNote={employerNote}
          employerRating={employerRating}
          assessmentDirty={assessmentDirty}
          history={historyQuery.data || []}
          historyLoading={historyQuery.isLoading}
          historyError={historyQuery.error}
          updating={updateMutation.isPending}
          onStatusChange={changeStatus}
          onEmployerNoteChange={(value) => {
            setEmployerNote(value)
            setAssessmentDirty(true)
          }}
          onEmployerRatingChange={(value) => {
            setEmployerRating(value)
            setAssessmentDirty(true)
          }}
          onSaveAssessment={saveAssessment}
          onRetryHistory={() => historyQuery.refetch()}
        />
      </div>
    </section>
  )
}
