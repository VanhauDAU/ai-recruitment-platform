import { FilterOutlined, SendOutlined } from '@ant-design/icons'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Alert, Button, Drawer, Grid, Pagination, Select, Skeleton } from 'antd'
import { lazy, Suspense, useState } from 'react'
import { getEmployerJobPage, jobKeys } from '@/entities/job/job'
import { getApiErrorMessage } from '@/shared/api/error-mapper'
import { m } from '@/shared/config/i18n'
import { message } from '@/shared/lib/toast'
import useConfirmAction from '@/shared/ui/confirm-action/use-confirm-action'
import { MascotEmpty } from '@/shared/ui/mascot'
import { candidateSearchKeys, inviteSearchCandidate, searchCandidates } from '../api/candidate-search.api'
import { activeFilterCount, EMPTY_FILTERS, filtersToParams, PAGE_SIZES } from '../model/search-filters'
import CandidateCard from './CandidateCard'
import CandidateFilters from './CandidateFilters'
import './candidate-search.css'

const CandidateQuickView = lazy(() => import('./CandidateQuickView'))

function canInvite(candidate) {
  return !candidate.applied && !candidate.invited
}

/** Mời lần lượt từng ứng viên (giữ giới hạn mời theo giờ của máy chủ); dừng khi bị chặn tần suất. */
async function inviteMany(refs, jobPublicId) {
  let sent = 0
  let error = null
  for (const ref of refs) {
    try {
      await inviteSearchCandidate(ref, jobPublicId)
      sent += 1
    } catch (caught) {
      error = caught
      if (caught?.response?.status === 429) break
    }
  }
  return { sent, failed: refs.length - sent, error }
}

/**
 * Tìm CV: chọn một tin đang tuyển, hệ thống xếp các ứng viên đang bật "cho phép NTD tìm
 * kiếm" theo mức phù hợp với tin. Kết quả ẩn danh; NTD gửi lời mời kết nối (một hoặc nhiều
 * người), ứng viên đồng ý thì nhắn tin được qua ProCV Connect.
 */
export default function CandidateSearchWorkspace({ jobPublicId, onJobChange }) {
  const queryClient = useQueryClient()
  const wide = Grid.useBreakpoint().xl
  const [draft, setDraft] = useState(EMPTY_FILTERS)
  const [applied, setApplied] = useState(EMPTY_FILTERS)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [pageSize, setPageSize] = useState(PAGE_SIZES[1])
  const filterParams = filtersToParams(applied)
  const signature = JSON.stringify([jobPublicId, filterParams, pageSize])
  const [pageState, setPageState] = useState({ signature, page: 1 })
  const page = pageState.signature === signature ? pageState.page : 1
  const listSignature = `${signature}|${page}`
  const [selection, setSelection] = useState({ signature: '', refs: [] })
  const selected = selection.signature === listSignature ? selection.refs : []
  const [opened, setOpened] = useState(null)
  const { confirmationModal, requestConfirmation } = useConfirmAction()

  const jobParams = { status: 'active', page_size: 100 }
  const jobsQuery = useQuery({
    queryKey: jobKeys.employerList(jobParams),
    queryFn: () => getEmployerJobPage(jobParams),
  })
  const params = { job: jobPublicId, page, page_size: pageSize, ...filterParams }
  const searchQuery = useQuery({
    queryKey: candidateSearchKeys.list(params),
    queryFn: () => searchCandidates(params),
    enabled: Boolean(jobPublicId),
    placeholderData: keepPreviousData,
  })
  const data = searchQuery.data || { count: 0, page_size: pageSize, results: [] }
  const invitable = data.results.filter(canInvite).map((candidate) => candidate.ref)
  const allSelected = invitable.length > 0 && invitable.every((ref) => selected.includes(ref))
  const filterCount = activeFilterCount(applied)
  const showList = Boolean(jobPublicId) && data.count > 0

  const inviteMutation = useMutation({
    mutationFn: (refs) => inviteMany(refs, jobPublicId),
    onSuccess: ({ sent, failed, error }) => {
      setSelection({ signature: '', refs: [] })
      queryClient.invalidateQueries({ queryKey: candidateSearchKeys.all() })
      if (sent) message.success(m.employer_workspace_search_bulk_sent({ count: sent }))
      if (failed) message.error(getApiErrorMessage(error, m.employer_workspace_search_bulk_failed({ count: failed })))
    },
  })

  function select(ref, checked) {
    const refs = checked ? [...selected, ref] : selected.filter((item) => item !== ref)
    setSelection({ signature: listSignature, refs })
  }

  function applyFilters() {
    setApplied(draft)
    setFiltersOpen(false)
  }

  function clearFilters() {
    setDraft(EMPTY_FILTERS)
    setApplied(EMPTY_FILTERS)
  }

  function confirmInvite() {
    requestConfirmation({
      title: m.employer_workspace_search_bulk_title({ count: selected.length }),
      description: m.employer_workspace_search_bulk_description(),
      confirmText: m.employer_workspace_search_invite(),
      onConfirm: () => inviteMutation.mutateAsync(selected),
    })
  }

  const rail = (
    <form
      className="cs-rail"
      aria-label={m.employer_workspace_search_filters_title()}
      onSubmit={(event) => {
        event.preventDefault()
        applyFilters()
      }}
    >
      {wide && <h2 className="cs-rail__title">{m.employer_workspace_search_filters_title()}</h2>}
      <div className="cs-rail__body">
        <CandidateFilters value={draft} onChange={setDraft} />
      </div>
      <div className="cs-rail__foot">
        <button type="button" className="cs-btn" onClick={clearFilters}>
          {m.employer_workspace_search_clear_filters()}
        </button>
        <button type="submit" className="cs-btn cs-btn--primary">{m.employer_workspace_search_submit()}</button>
      </div>
    </form>
  )

  let results
  if (!jobPublicId) {
    results = <MascotEmpty className="py-12" size={120} description={m.employer_workspace_search_pick_job()} />
  } else if (searchQuery.isError) {
    results = (
      <div className="cs-pad">
        <Alert
          showIcon
          type={searchQuery.error?.response?.status === 409 ? 'info' : 'error'}
          title={getApiErrorMessage(searchQuery.error, m.employer_workspace_search_load_failed())}
          action={<Button size="small" onClick={() => searchQuery.refetch()}>{m.employer_workspace_search_retry()}</Button>}
        />
      </div>
    )
  } else if (searchQuery.isLoading) {
    results = (
      <div className="cs-pad" aria-label={m.employer_workspace_search_loading_aria()}>
        <Skeleton active avatar paragraph={{ rows: 4 }} />
        <Skeleton active avatar paragraph={{ rows: 4 }} />
      </div>
    )
  } else if (data.results.length === 0) {
    results = (
      <div className="cs-empty">
        <p>{filterCount ? m.employer_workspace_search_no_match() : m.employer_workspace_search_empty()}</p>
        {filterCount > 0 && (
          <button type="button" className="cs-btn" onClick={clearFilters}>{m.employer_workspace_search_clear_filters()}</button>
        )}
      </div>
    )
  } else {
    results = (
      <ul className="cs-list" data-stale={searchQuery.isPlaceholderData || undefined}>
        {data.results.map((candidate) => (
          <CandidateCard
            key={candidate.ref}
            candidate={candidate}
            selected={selected.includes(candidate.ref)}
            selectable={canInvite(candidate)}
            onSelect={select}
            onOpen={setOpened}
          />
        ))}
      </ul>
    )
  }

  return (
    <div className="cs-workspace">
      {wide && rail}

      <section className="cs-results" aria-labelledby="cs-results-title">
        <header className="cs-results__head">
          <h2 id="cs-results-title" className="cs-results__title">{m.employer_workspace_search_results_title()}</h2>
          <div className="cs-results__tools">
            <Select
              className="cs-job"
              aria-label={m.employer_workspace_search_job_aria()}
              placeholder={m.employer_workspace_search_job_placeholder()}
              loading={jobsQuery.isPending}
              value={jobPublicId || undefined}
              options={(jobsQuery.data?.results || []).map((job) => ({ value: job.public_id, label: job.title }))}
              onChange={onJobChange}
              showSearch
              optionFilterProp="label"
            />
            {!wide && (
              <button type="button" className="cs-btn" onClick={() => setFiltersOpen(true)}>
                <FilterOutlined aria-hidden />
                {filterCount
                  ? m.employer_workspace_search_filters_count({ count: filterCount })
                  : m.employer_workspace_search_filters_title()}
              </button>
            )}
          </div>
        </header>

        {showList && (
          <div className="cs-bar">
            <label className="cs-bar__all">
              <input
                type="checkbox"
                className="cs-check"
                checked={allSelected}
                disabled={invitable.length === 0}
                onChange={(event) => setSelection({ signature: listSignature, refs: event.target.checked ? invitable : [] })}
              />
              {m.employer_workspace_search_select_all()}
            </label>
            <span className="cs-bar__count">{m.employer_workspace_search_matches({ count: data.count })}</span>
            <span className="cs-bar__picked">{m.employer_workspace_search_selected({ count: selected.length })}</span>
            <button
              type="button"
              className="cs-btn cs-btn--accent"
              disabled={selected.length === 0 || inviteMutation.isPending}
              onClick={confirmInvite}
            >
              <SendOutlined aria-hidden />
              {m.employer_workspace_search_invite()}
            </button>
          </div>
        )}

        {results}

        {showList && (
          <footer className="cs-pager">
            <label className="cs-pager__size">
              {m.employer_workspace_search_page_size()}
              <Select
                size="small"
                value={pageSize}
                onChange={setPageSize}
                options={PAGE_SIZES.map((size) => ({ value: size, label: size }))}
                aria-label={m.employer_workspace_search_page_size()}
              />
            </label>
            {data.count > pageSize && (
              <Pagination
                size="small"
                current={page}
                pageSize={pageSize}
                total={data.count}
                showSizeChanger={false}
                onChange={(next) => setPageState({ signature, page: next })}
              />
            )}
          </footer>
        )}
      </section>

      {!wide && (
        <Drawer
          open={filtersOpen}
          onClose={() => setFiltersOpen(false)}
          placement="left"
          size={360}
          title={m.employer_workspace_search_filters_title()}
          rootClassName="cs-drawer"
          styles={{ body: { padding: 0 } }}
        >
          {rail}
        </Drawer>
      )}

      {opened && (
        <Suspense fallback={null}>
          <CandidateQuickView candidate={opened} jobPublicId={jobPublicId} onClose={() => setOpened(null)} />
        </Suspense>
      )}
      {confirmationModal}
    </div>
  )
}
