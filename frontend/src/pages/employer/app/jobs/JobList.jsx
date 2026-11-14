import { PlusOutlined, SearchOutlined } from '@ant-design/icons'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Alert, Button, Empty, Input, Pagination, Skeleton } from 'antd'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import {
  closeEmployerJob,
  deleteEmployerJob,
  duplicateEmployerJob,
  getEmployerJobPage,
  jobKeys,
} from '@/entities/job'
import { useEmployerReadiness } from '@/entities/employer-profile'
import { getApiErrorMessage } from '@/shared/api/error-mapper'
import { employerAppPath } from '@/shared/config/portals'
import { message } from '@/shared/lib/toast'
import { MascotEmpty } from '@/shared/ui/mascot'
import useConfirmAction from '@/shared/ui/use-confirm-action'
import JobListCard from './JobListCard'
import { JOB_STATUS_TABS, formatCount } from './job-list-presentation'
import './employer-jobs.css'

const PAGE_SIZE = 20
const SEARCH_DELAY_MS = 400
const EMPTY_PAGE = { count: 0, next: null, previous: null, results: [] }
const primaryLinkClass = 'inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-lg !bg-emerald-600 px-3.5 text-sm font-semibold !text-white shadow-sm transition hover:!bg-emerald-500'

function JobListSkeleton() {
  return (
    <div className="divide-y divide-slate-100" aria-label="Đang tải danh sách tin tuyển dụng">
      {[1, 2, 3, 4].map((item) => (
        <div key={item} className="job-row flex flex-col gap-3 px-4 py-4">
          <Skeleton active title={{ width: '55%' }} paragraph={{ rows: 1, width: '80%' }} />
          <Skeleton.Input active size="small" className="!w-40" />
          <Skeleton.Input active size="small" className="!w-28" />
          <Skeleton.Input active size="small" className="!w-28" />
        </div>
      ))}
    </div>
  )
}

function useJobMutation(mutationFn, success, failure) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jobs', 'employer-list'] })
      message.success(success)
    },
    onError: (error) => message.error(getApiErrorMessage(error, failure)),
  })
}

export default function JobList() {
  const [searchParams, setSearchParams] = useSearchParams()
  const status = searchParams.get('status') || ''
  const query = searchParams.get('q') || ''
  const page = Math.max(Number(searchParams.get('page')) || 1, 1)
  const [searchValue, setSearchValue] = useState(query)
  const searchTimer = useRef(null)
  const { confirmationModal, requestConfirmation } = useConfirmAction()
  const { canAccessCandidateData } = useEmployerReadiness()
  const queryParams = useMemo(() => ({
    page,
    ...(status ? { status } : {}),
    ...(query ? { q: query } : {}),
  }), [page, query, status])
  const jobsQuery = useQuery({
    queryKey: jobKeys.employerList(queryParams),
    queryFn: () => getEmployerJobPage(queryParams),
    // Keep the rows and tab counts on screen while the next tab/page loads.
    placeholderData: keepPreviousData,
  })
  const closeMutation = useJobMutation(closeEmployerJob, 'Đã đóng tin tuyển dụng.', 'Không thể đóng tin.')
  const duplicateMutation = useJobMutation(duplicateEmployerJob, 'Đã tạo bản nháp sao chép.', 'Không thể sao chép tin.')
  const deleteMutation = useJobMutation(deleteEmployerJob, 'Đã xóa bản nháp.', 'Không thể xóa bản nháp.')
  const pageData = jobsQuery.data || EMPTY_PAGE
  const jobs = pageData.results || []
  const counts = pageData.status_counts
  const hasFilters = Boolean(query || status)

  // Follow back/forward navigation without trimming what the user is typing.
  useEffect(() => {
    setSearchValue((current) => (current.trim() === query ? current : query))
  }, [query])
  useEffect(() => () => window.clearTimeout(searchTimer.current), [])

  // Functional update so a debounced search never overwrites a newer tab/page.
  const replaceFilters = useCallback((next, options) => {
    setSearchParams((current) => {
      const params = new URLSearchParams(current)
      Object.entries(next).forEach(([key, value]) => {
        if (value) params.set(key, String(value))
        else params.delete(key)
      })
      if (!Object.hasOwn(next, 'page')) params.delete('page')
      return params
    }, options)
  }, [setSearchParams])

  function search(value, delay = SEARCH_DELAY_MS) {
    setSearchValue(value)
    window.clearTimeout(searchTimer.current)
    searchTimer.current = window.setTimeout(() => replaceFilters({ q: value.trim() }, { replace: true }), delay)
  }

  function clearFilters() {
    window.clearTimeout(searchTimer.current)
    setSearchValue('')
    setSearchParams({})
  }

  const isBusy = (mutation, publicId) => mutation.isPending && mutation.variables === publicId
  const firstRow = (page - 1) * PAGE_SIZE + 1
  const lastRow = Math.min(page * PAGE_SIZE, pageData.count || 0)

  return (
    <section className="pb-5 pt-3">
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs">
        <div className="job-list-toolbar border-b border-slate-200 px-3 pt-3 sm:px-4">
          <div className="job-list-toolbar__search flex items-center gap-2">
            <Input
              allowClear
              aria-label="Tìm tin tuyển dụng"
              className="!h-9 min-w-0 flex-1"
              prefix={<SearchOutlined className="text-slate-400" aria-hidden />}
              placeholder="Tìm theo tên tin tuyển dụng"
              type="search"
              value={searchValue}
              onChange={(event) => search(event.target.value)}
              onClear={() => search('', 0)}
              onPressEnter={() => search(searchValue, 0)}
            />
            <Link aria-label="Đăng tin tuyển dụng" className={primaryLinkClass} to={employerAppPath('/jobs/new')}>
              <PlusOutlined aria-hidden />
              <span className="hidden sm:inline">Đăng tin tuyển dụng</span>
              <span className="sm:hidden">Đăng tin</span>
            </Link>
          </div>
          <div role="group" aria-label="Lọc theo trạng thái tin" className="job-strip">
            {JOB_STATUS_TABS.map((tab) => {
              const active = status === tab.value
              const count = counts?.[tab.countKey]
              return (
                <button
                  key={tab.countKey}
                  type="button"
                  aria-pressed={active}
                  className="job-filter-tab"
                  onClick={() => replaceFilters({ status: tab.value })}
                >
                  {tab.label}
                  {count === undefined
                    ? <span aria-hidden className="h-4 w-6 animate-pulse rounded-full bg-slate-100" />
                    : <span className="job-filter-tab__count">{formatCount(count)}</span>}
                </button>
              )
            })}
          </div>
        </div>

        <div className="job-table-head border-b border-slate-100 bg-slate-50/70 px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
          <span>Tin tuyển dụng</span>
          <span>Hồ sơ ứng tuyển</span>
          <span>Hiệu quả</span>
          <span>Hạn nhận hồ sơ</span>
          <span className="sr-only">Thao tác</span>
        </div>

        {jobsQuery.isError && (
          <div className="p-3">
            <Alert
              type="error"
              showIcon
              title={`Không thể tải danh sách tin tuyển dụng. ${getApiErrorMessage(jobsQuery.error, 'Vui lòng thử lại sau.')}`}
              action={<Button size="small" danger onClick={() => jobsQuery.refetch()}>Thử lại</Button>}
            />
          </div>
        )}

        {jobsQuery.isLoading ? (
          <JobListSkeleton />
        ) : jobs.length === 0 && !jobsQuery.isError ? (
          hasFilters ? (
            <div className="py-14">
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Không có tin phù hợp với bộ lọc">
                <Button onClick={clearFilters}>Xóa bộ lọc</Button>
              </Empty>
            </div>
          ) : (
            <MascotEmpty className="py-12" description="Bạn chưa có tin tuyển dụng nào. Đăng tin đầu tiên để bắt đầu nhận hồ sơ.">
              <Link className={primaryLinkClass} to={employerAppPath('/jobs/new')}>
                <PlusOutlined /> Đăng tin đầu tiên
              </Link>
            </MascotEmpty>
          )
        ) : (
          <div
            aria-busy={jobsQuery.isFetching}
            aria-live="polite"
            className={`divide-y divide-slate-100 transition-opacity ${jobsQuery.isPlaceholderData ? 'opacity-60' : ''}`}
          >
            {jobs.map((job) => (
              <JobListCard
                key={job.public_id}
                job={job}
                candidateDataAccess={canAccessCandidateData}
                busy={[closeMutation, deleteMutation, duplicateMutation].some((item) => isBusy(item, job.public_id))}
                onClose={(publicId) => closeMutation.mutateAsync(publicId)}
                onDelete={(publicId) => deleteMutation.mutateAsync(publicId)}
                onDuplicate={(publicId) => duplicateMutation.mutate(publicId)}
                requestConfirmation={requestConfirmation}
              />
            ))}
          </div>
        )}

        {pageData.count > 0 && (
          <div className="flex flex-col items-center justify-between gap-2 border-t border-slate-100 px-4 py-3 text-xs text-slate-500 sm:flex-row">
            <span>Hiển thị {firstRow}–{lastRow} trên {formatCount(pageData.count)} tin</span>
            {pageData.count > PAGE_SIZE && (
              <Pagination
                size="small"
                current={page}
                pageSize={PAGE_SIZE}
                total={pageData.count}
                showSizeChanger={false}
                onChange={(nextPage) => replaceFilters({ page: nextPage })}
              />
            )}
          </div>
        )}
      </div>
      {confirmationModal}
    </section>
  )
}
