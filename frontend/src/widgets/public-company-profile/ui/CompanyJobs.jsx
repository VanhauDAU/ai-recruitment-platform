import { ReloadOutlined, SearchOutlined } from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import { Pagination } from 'antd'
import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import {
  COMPANY_JOBS_TAB,
  companyDetailPath,
  companyKeys,
  getCompanyJobFacets,
} from '@/entities/company'
import { COMPANY_JOBS_PAGE_SIZE, useCompanyJobs } from '../model/use-company-jobs'
import CompanyJobCard from './CompanyJobCard'

const PREVIEW_COUNT = 5
const SKELETON_COUNT = 3
const FACETS_STALE_TIME = 5 * 60_000

function JobListSkeleton() {
  return (
    <div className="space-y-3" aria-label="Đang tải việc làm">
      {Array.from({ length: SKELETON_COUNT }, (_, index) => (
        <div key={index} className="h-24 motion-safe:animate-pulse rounded-xl bg-slate-100" aria-hidden="true" />
      ))}
    </div>
  )
}

function JobListError({ onRetry }) {
  return (
    <div className="rounded-xl bg-slate-50 px-3 py-4 text-center" role="alert">
      <p className="text-sm text-slate-500">Chưa thể tải danh sách việc làm.</p>
      <button type="button" onClick={onRetry} className="mt-3 inline-flex items-center gap-1.5 text-sm font-bold text-emerald-700 hover:text-emerald-800">
        <ReloadOutlined aria-hidden="true" /> Thử lại
      </button>
    </div>
  )
}

function JobList({ jobs }) {
  return (
    <div className="space-y-3">
      {jobs.map((job) => <CompanyJobCard key={job.public_id} job={job} />)}
    </div>
  )
}

const NO_JOBS = <p className="text-sm text-slate-500">Công ty chưa có việc làm đang tuyển.</p>

/** Thân khối "việc làm" ở tab tổng quan: vài tin đầu và lối sang tab việc làm. */
export function CompanyJobsPreview({ company, jobsPath }) {
  const { jobs, isPending, isError, refetch } = useCompanyJobs(company.public_id)

  if (isPending) return <JobListSkeleton />
  if (isError) return <JobListError onRetry={refetch} />
  if (jobs.length === 0) return NO_JOBS

  return (
    <>
      <JobList jobs={jobs.slice(0, PREVIEW_COUNT)} />
      <div className="mt-4 flex justify-center">
        <Link
          to={jobsPath}
          className="inline-flex h-10 items-center gap-2 rounded-lg border border-emerald-200 px-4 text-sm font-semibold !text-[var(--brand-primary)] hover:!bg-emerald-50"
        >
          Xem tất cả việc làm
        </Link>
      </div>
    </>
  )
}

/** Thân khối "việc làm" ở tab việc làm; từ khoá, địa điểm và trang đều là trạng thái URL. */
export function CompanyJobsTab({ company, q, location, page }) {
  const navigate = useNavigate()
  const [draft, setDraft] = useState(q)
  const { jobs, count, isPending, isError, refetch } = useCompanyJobs(
    company.public_id,
    { q, location, page },
  )
  const facetsQuery = useQuery({
    queryKey: companyKeys.jobFacets(company.public_id),
    queryFn: ({ signal }) => getCompanyJobFacets(company.public_id, { signal }),
    staleTime: FACETS_STALE_TIME,
  })
  const locations = facetsQuery.data?.locations || []
  const hasFilters = Boolean(q || location)
  const jobsPath = companyDetailPath(company.slug, { tab: COMPANY_JOBS_TAB })

  useEffect(() => setDraft(q), [q])

  // Đổi bộ lọc luôn quay về trang 1; chỉ phân trang mới truyền `page`.
  function show(view) {
    navigate(companyDetailPath(company.slug, { tab: COMPANY_JOBS_TAB, ...view }))
  }

  function submit(event) {
    event.preventDefault()
    show({ q: draft, location })
  }

  return (
    <>
      <form onSubmit={submit} role="search" aria-label="Tìm việc làm của công ty" className="company-jobs-filter">
        <label className="company-jobs-filter__keyword">
          <SearchOutlined aria-hidden="true" />
          <span className="sr-only">Tên việc làm</span>
          <input
            type="search"
            value={draft}
            maxLength={120}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Tìm theo tên việc làm"
          />
        </label>
        <label>
          <span className="sr-only">Địa điểm</span>
          <select value={location} onChange={(event) => show({ q: draft, location: event.target.value })}>
            <option value="">Tất cả địa điểm</option>
            {location && !locations.some((item) => String(item.id) === location) && (
              <option value={location}>Địa điểm đang chọn</option>
            )}
            {locations.map((item) => (
              <option key={item.id} value={String(item.id)}>{item.name} ({item.count})</option>
            ))}
          </select>
        </label>
        <button type="submit" className="h-11 shrink-0 cursor-pointer rounded-lg bg-[var(--brand-primary)] px-5 text-sm font-bold text-white transition hover:bg-[var(--brand-primary-hover)]">
          Tìm kiếm
        </button>
      </form>

      <p className="mb-3 mt-4 text-sm text-slate-500" role="status">
        {isPending
          ? 'Đang tải việc làm…'
          : isError
            ? ''
            : hasFilters
              ? `Tìm thấy ${count.toLocaleString('vi-VN')} việc làm phù hợp`
              : `${count.toLocaleString('vi-VN')} việc làm đang tuyển`}
      </p>

      {isPending && <JobListSkeleton />}
      {isError && <JobListError onRetry={refetch} />}
      {!isPending && !isError && jobs.length === 0 && (hasFilters
        ? (
            <p className="text-sm text-slate-500">
              Không có việc làm khớp bộ lọc.{' '}
              <Link to={jobsPath} className="font-semibold !text-[var(--brand-primary)] hover:underline">Xoá bộ lọc</Link>
            </p>
          )
        : NO_JOBS)}
      {jobs.length > 0 && <JobList jobs={jobs} />}

      {count > COMPANY_JOBS_PAGE_SIZE && (
        <div className="mt-6 flex justify-center">
          <Pagination
            current={page}
            pageSize={COMPANY_JOBS_PAGE_SIZE}
            total={count}
            showSizeChanger={false}
            onChange={(nextPage) => show({ q, location, page: nextPage })}
          />
        </div>
      )}
    </>
  )
}
