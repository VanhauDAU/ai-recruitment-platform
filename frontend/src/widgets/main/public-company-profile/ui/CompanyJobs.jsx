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
} from '@/entities/company/company'
import { COMPANY_JOBS_PAGE_SIZE, useCompanyJobs } from '../model/use-company-jobs'
import CompanyJobCard from './CompanyJobCard'
import { getIntlLocale, m } from '@/shared/config/i18n'

const PREVIEW_COUNT = 5
const SKELETON_COUNT = 3
const FACETS_STALE_TIME = 5 * 60_000

function JobListSkeleton() {
  return (
    <div className="space-y-3" aria-label="Đang tải tin tuyển dụng">
      {Array.from({ length: SKELETON_COUNT }, (_, index) => (
        <div key={index} className="h-32 motion-safe:animate-pulse rounded-xl bg-slate-100" aria-hidden="true" />
      ))}
    </div>
  )
}

function JobListError({ onRetry }) {
  return (
    <div className="rounded-xl bg-slate-50 px-3 py-4 text-center" role="alert">
      <p className="text-sm text-slate-500">Chưa thể tải danh sách tin tuyển dụng.</p>
      <button type="button" onClick={onRetry} className="mt-3 inline-flex items-center gap-1.5 text-sm font-bold text-emerald-700 hover:text-emerald-800">
        <ReloadOutlined aria-hidden="true" /> Thử lại
      </button>
    </div>
  )
}

// Tin công ty ghim: API đã xếp chúng lên đầu, ở đây chỉ gắn nhãn "Nổi bật".
function pinnedJobIds(company) {
  return (company.sections || []).find((section) => section.type === 'jobs')?.pinned_job_public_ids || []
}

function JobList({ jobs, pinnedIds }) {
  return (
    <div className="space-y-3">
      {jobs.map((job) => (
        <CompanyJobCard key={job.public_id} job={job} pinned={pinnedIds.includes(job.public_id)} />
      ))}
    </div>
  )
}

const NO_JOBS = <p className="text-sm text-slate-500">Công ty chưa có tin tuyển dụng đang mở.</p>

/** Thân khối "việc làm" ở tab tổng quan: vài tin đầu và lối sang tab tin tuyển dụng. */
export function CompanyJobsPreview({ company, jobsPath }) {
  const { jobs, isPending, isError, refetch } = useCompanyJobs(company.public_id)

  if (isPending) return <JobListSkeleton />
  if (isError) return <JobListError onRetry={refetch} />
  if (jobs.length === 0) return NO_JOBS

  return (
    <>
      <JobList jobs={jobs.slice(0, PREVIEW_COUNT)} pinnedIds={pinnedJobIds(company)} />
      <div className="mt-4 flex justify-center">
        <Link
          to={jobsPath}
          className="inline-flex h-10 items-center gap-2 rounded-lg border border-emerald-200 px-4 text-sm font-semibold !text-[var(--brand-primary)] hover:!bg-emerald-50"
        >
          Xem tất cả tin tuyển dụng
        </Link>
      </div>
    </>
  )
}

/**
 * Lựa chọn danh mục sau khi bấm `id`. Chọn nhóm bao luôn mọi chuyên môn con (các
 * chip con sáng theo); bỏ một chip con khi cả nhóm đang chọn thì giữ các chip còn
 * lại; chọn đủ mọi chip con thì gộp lại thành nhóm.
 */
function toggleCategory(selected, group, id) {
  const next = new Set(selected)
  const childIds = group.children.map((child) => String(child.id))
  if (id === String(group.id)) {
    childIds.forEach((childId) => next.delete(childId))
    if (selected.has(id)) next.delete(id)
    else next.add(id)
  } else if (selected.has(String(group.id))) {
    next.delete(String(group.id))
    childIds.filter((childId) => childId !== id).forEach((childId) => next.add(childId))
  } else {
    if (next.has(id)) next.delete(id)
    else next.add(id)
    if (childIds.length > 1 && childIds.every((childId) => next.has(childId))) {
      childIds.forEach((childId) => next.delete(childId))
      next.add(String(group.id))
    }
  }
  return [...next].join(',')
}

/** Danh mục nghề của các tin đang mở: nhóm (checkbox) và chuyên môn con (chip), chọn nhiều. */
function CategoryFilter({ categories, selected, onSelect }) {
  if (categories.length === 0) {
    return <p className="text-sm text-slate-500">{m.company_jobs_categories_empty()}</p>
  }
  const chosen = new Set(selected ? selected.split(',') : [])

  return (
    <ul className="company-categories">
      {categories.map((group) => {
        const groupChosen = chosen.has(String(group.id))
        const someChildren = group.children.some((child) => chosen.has(String(child.id)))
        return (
          <li key={group.id} className="company-category">
            <label className="company-category__group">
              <input
                type="checkbox"
                checked={groupChosen}
                ref={(input) => { if (input) input.indeterminate = !groupChosen && someChildren }}
                onChange={() => onSelect(toggleCategory(chosen, group, String(group.id)))}
              />
              <span className="min-w-0">
                {group.name} <span className="company-category__count">({group.count})</span>
              </span>
            </label>
            {group.children.length > 0 && (
              <div className="company-category__children">
                {group.children.map((child) => (
                  <button
                    key={child.id}
                    type="button"
                    title={`${child.name} (${child.count})`}
                    aria-pressed={groupChosen || chosen.has(String(child.id))}
                    className="company-category__chip"
                    onClick={() => onSelect(toggleCategory(chosen, group, String(child.id)))}
                  >
                    {child.name}
                  </button>
                ))}
              </div>
            )}
          </li>
        )
      })}
    </ul>
  )
}

/**
 * Tab tin tuyển dụng: cột danh mục nghề (30%) và cột danh sách có bộ lọc (70%).
 * Từ khoá, địa điểm, danh mục và trang đều là trạng thái URL.
 */
export function CompanyJobsTab({ company, q, location, category, page }) {
  const navigate = useNavigate()
  const [draft, setDraft] = useState(q)
  const { jobs, count, isPending, isError, refetch } = useCompanyJobs(
    company.public_id,
    { q, location, category, page },
  )
  const facetsQuery = useQuery({
    queryKey: companyKeys.jobFacets(company.public_id),
    queryFn: ({ signal }) => getCompanyJobFacets(company.public_id, { signal }),
    staleTime: FACETS_STALE_TIME,
  })
  const locations = facetsQuery.data?.locations || []
  const categories = facetsQuery.data?.categories || []
  const hasFilters = Boolean(q || location || category)
  const jobsPath = companyDetailPath(company.slug, { tab: COMPANY_JOBS_TAB })

  useEffect(() => setDraft(q), [q])

  // Đổi bộ lọc luôn quay về trang 1; chỉ phân trang mới truyền `page`.
  function show(view) {
    navigate(companyDetailPath(company.slug, { tab: COMPANY_JOBS_TAB, q: draft, location, category, ...view }))
  }

  function submit(event) {
    event.preventDefault()
    show({})
  }

  return (
    <>
      <h2 className="company-jobs-title">{m.company_jobs_heading({ company: company.identity.display_name })}</h2>
      <div className="company-jobs-layout">
        <aside className="company-jobs-panel" aria-labelledby="company-categories-title">
          <h3 id="company-categories-title" className="company-jobs-panel__title">{m.company_jobs_categories()}</h3>
          {facetsQuery.isPending
            ? <div className="h-40 motion-safe:animate-pulse rounded-lg bg-slate-100" aria-hidden="true" />
            : <CategoryFilter categories={categories} selected={category} onSelect={(next) => show({ category: next })} />}
        </aside>

        <section className="company-jobs-panel" aria-labelledby="company-jobs-title">
          <h3 id="company-jobs-title" className="company-jobs-panel__title">{m.company_jobs_list_title()}</h3>
          <form onSubmit={submit} role="search" aria-label="Tìm tin tuyển dụng của công ty" className="company-jobs-filter">
            <label className="company-jobs-filter__keyword">
              <SearchOutlined aria-hidden="true" />
              <span className="sr-only">{m.company_jobs_keyword_label()}</span>
              <input
                type="search"
                value={draft}
                maxLength={120}
                onChange={(event) => setDraft(event.target.value)}
                placeholder={m.company_jobs_keyword_placeholder()}
              />
            </label>
            <label>
              <span className="sr-only">Địa điểm</span>
              <select value={location} onChange={(event) => show({ location: event.target.value })}>
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
              ? 'Đang tải tin tuyển dụng…'
              : isError
                ? ''
                : hasFilters
                  ? `Tìm thấy ${count.toLocaleString(getIntlLocale())} tin tuyển dụng phù hợp`
                  : `${count.toLocaleString(getIntlLocale())} tin tuyển dụng đang mở`}
          </p>

          {isPending && <JobListSkeleton />}
          {isError && <JobListError onRetry={refetch} />}
          {!isPending && !isError && jobs.length === 0 && (hasFilters
            ? (
                <p className="text-sm text-slate-500">
                  Không có tin tuyển dụng khớp bộ lọc.{' '}
                  <Link to={jobsPath} className="font-semibold !text-[var(--brand-primary)] hover:underline">Xoá bộ lọc</Link>
                </p>
              )
            : NO_JOBS)}
          {jobs.length > 0 && <JobList jobs={jobs} pinnedIds={pinnedJobIds(company)} />}

          {count > COMPANY_JOBS_PAGE_SIZE && (
            <div className="mt-6 flex justify-center">
              <Pagination
                current={page}
                pageSize={COMPANY_JOBS_PAGE_SIZE}
                total={count}
                showSizeChanger={false}
                onChange={(nextPage) => show({ q, page: nextPage })}
              />
            </div>
          )}
        </section>
      </div>
    </>
  )
}
