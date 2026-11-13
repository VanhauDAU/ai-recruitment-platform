import {
  CloseOutlined,
  CopyOutlined,
  PlusOutlined,
  ReloadOutlined,
} from '@ant-design/icons'
import { Skeleton, Switch } from 'antd'
import { useQueries } from '@tanstack/react-query'
import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import {
  companyInitial,
  formatSalary,
  getJobDetail,
  jobDetailPath,
  jobKeys,
  JobRichContent,
  VerifiedEmployerBadge,
} from '@/entities/job'
import { message } from '@/shared/lib/toast'
import {
  COMPARISON_GROUPS,
  comparisonRowIsDifferent,
  MISSING_VALUE,
} from '../lib/comparison-presentation'
import { comparisonSearchParams, parseComparisonSlugs } from '../model/comparison-url'
import useJobComparison from '../model/use-job-comparison'

function isNotFound(error) {
  return error?.response?.status === 404
}

function textLength(value) {
  return String(value || '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim().length
}

function ExpandableValue({ value }) {
  const [expanded, setExpanded] = useState(false)
  const contentId = useId()
  const expandable = textLength(value.display) > 180

  if (value.kind === 'link') {
    return value.href
      ? <a href={value.href} target="_blank" rel="noreferrer" className="break-all font-medium text-[var(--brand-primary)] hover:underline">{value.display}</a>
      : <MissingValue />
  }

  if (value.kind === 'list' && value.items?.length) {
    return (
      <ul className="space-y-1.5 text-sm leading-6 text-slate-700">
        {value.items.map((item) => <li key={item} className="flex gap-2"><span aria-hidden="true" className="mt-2 h-1 w-1 shrink-0 rounded-full bg-slate-400" /><span>{item}</span></li>)}
      </ul>
    )
  }

  if (value.kind === 'rich' || value.kind === 'long-text') {
    return (
      <div>
        <div id={contentId} className={`relative ${expanded || !expandable ? '' : 'max-h-32 overflow-hidden'}`}>
          {value.kind === 'rich'
            ? <JobRichContent html={value.display} />
            : <p className="whitespace-pre-line text-sm leading-6 text-slate-700">{value.display}</p>}
          {!expanded && expandable && <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 h-12 bg-gradient-to-b from-white/0 to-white" />}
        </div>
        {expandable && (
          <button
            type="button"
            aria-controls={contentId}
            aria-expanded={expanded}
            onClick={() => setExpanded((current) => !current)}
            className="mt-2 min-h-9 text-xs font-semibold text-[var(--brand-primary)] hover:underline"
          >
            {expanded ? 'Thu gọn' : 'Xem đầy đủ'}
          </button>
        )}
      </div>
    )
  }

  return value.display === MISSING_VALUE ? <MissingValue /> : <span className="text-sm leading-6 text-slate-700">{value.display}</span>
}

function MissingValue() {
  return <span className="text-sm italic text-slate-400">{MISSING_VALUE}</span>
}

function Logo({ job }) {
  return (
    <span className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-white font-bold text-[var(--brand-primary)] shadow-sm">
      {job.company_logo_url
        ? <img src={job.company_logo_url} alt="" className="h-full w-full object-contain p-1" />
        : companyInitial(job.company_name)}
    </span>
  )
}

function JobHeader({ state, onRemove, tableHeader = false }) {
  const { job, query, slug } = state
  const wrapper = tableHeader ? 'p-3 text-left' : 'rounded-2xl border border-slate-200 bg-white p-4 shadow-sm'

  if (query.isPending) {
    return <div className={wrapper}><Skeleton active avatar paragraph={{ rows: 2 }} /></div>
  }

  if (query.isError) {
    const unavailable = isNotFound(query.error)
    return (
      <div className={wrapper}>
        <p className="text-sm font-bold text-slate-800">{unavailable ? 'Tin không còn khả dụng' : 'Chưa tải được việc làm'}</p>
        <p className="mt-1 break-all text-xs text-slate-500">{slug}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {!unavailable && <button type="button" onClick={() => query.refetch()} className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-slate-200 px-3 text-xs font-semibold text-slate-600"><ReloadOutlined /> Thử lại</button>}
          <button type="button" onClick={() => onRemove(slug)} className="min-h-10 rounded-lg px-3 text-xs font-semibold text-slate-500 hover:bg-slate-50">Bỏ khỏi so sánh</button>
        </div>
      </div>
    )
  }

  return (
    <div className={wrapper}>
      <div className="flex items-start gap-3">
        <Logo job={job} />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h2 className="line-clamp-2 text-sm font-bold leading-5 text-slate-900 sm:text-base">{job.title}</h2>
            <button type="button" onClick={() => onRemove(slug)} aria-label={`Bỏ ${job.title} khỏi so sánh`} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-50 hover:text-slate-700"><CloseOutlined /></button>
          </div>
          <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500">{job.company_name}</p>
          <VerifiedEmployerBadge verification={job.company_verification} verified={job.company_verified} showCriteria appearance="label" className="mt-1.5" />
        </div>
      </div>
      <p className="mt-3 text-base font-extrabold text-[var(--brand-primary)]">{formatSalary(job)}</p>
      <Link to={jobDetailPath(job)} className="mt-3 inline-flex min-h-10 items-center text-sm font-semibold !text-slate-700 hover:!text-[var(--brand-primary)] hover:underline">Xem chi tiết & ứng tuyển →</Link>
    </div>
  )
}

function DesktopMatrix({ groups, states, jobs, onRemove }) {
  return (
    <div className="hidden overflow-visible rounded-2xl border border-slate-200 bg-white shadow-sm lg:block">
      <table className="w-full table-fixed border-collapse" aria-label="Bảng so sánh việc làm">
        <colgroup>
          <col className="w-48" />
          {states.map((state) => <col key={state.slug} />)}
        </colgroup>
        <thead className="sticky top-16 z-10 bg-white shadow-[0_1px_0_#e2e8f0]">
          <tr>
            <th scope="col" className="border-r border-slate-200 p-4 text-left text-xs font-bold uppercase tracking-wide text-slate-500">Tiêu chí</th>
            {states.map((state) => <th key={state.slug} scope="col" className="border-r border-slate-200 align-top last:border-r-0"><JobHeader state={state} onRemove={onRemove} tableHeader /></th>)}
          </tr>
        </thead>
        <tbody>
          {groups.map((group) => (
            <ComparisonGroupRows key={group.key} group={group} states={states} jobs={jobs} />
          ))}
        </tbody>
      </table>
    </div>
  )
}

function ComparisonGroupRows({ group, states, jobs }) {
  return (
    <>
      <tr><th colSpan={states.length + 1} className="border-y border-slate-200 bg-slate-50 px-4 py-3 text-left text-sm font-bold text-slate-800">{group.title}</th></tr>
      {group.rows.map((row) => {
        const different = comparisonRowIsDifferent(row, jobs)
        return (
          <tr key={row.key} className={different ? 'bg-slate-50/55' : 'bg-white'}>
            <th scope="row" className="border-b border-r border-slate-100 px-4 py-4 text-left align-top text-sm font-semibold text-slate-600">
              <span className="flex items-center gap-2">{different && <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-[var(--brand-primary)]" />}{row.label}</span>
            </th>
            {states.map((state) => (
              <td key={state.slug} className="border-b border-r border-slate-100 px-4 py-4 align-top last:border-r-0">
                {state.job ? <ExpandableValue value={row.value(state.job)} /> : <span className="text-slate-300">—</span>}
              </td>
            ))}
          </tr>
        )
      })}
    </>
  )
}

function CompactMatrix({ groups, states, jobs, onRemove }) {
  return (
    <div className="lg:hidden">
      <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
        {states.map((state) => <JobHeader key={state.slug} state={state} onRemove={onRemove} />)}
      </div>
      <div className="mt-5 space-y-4">
        {groups.map((group) => (
          <section key={group.key} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <h2 className="border-b border-slate-200 bg-slate-50 px-4 py-3 text-base font-bold text-slate-800">{group.title}</h2>
            <div className="divide-y divide-slate-100">
              {group.rows.map((row) => {
                const different = comparisonRowIsDifferent(row, jobs)
                return (
                  <article key={row.key} className={`p-4 ${different ? 'bg-slate-50/55' : ''}`}>
                    <h3 className="flex items-center gap-2 text-sm font-bold text-slate-700">
                      {different && <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-[var(--brand-primary)]" />}
                      {row.label}
                    </h3>
                    <dl className="mt-3 space-y-3">
                      {states.map((state, index) => (
                        <div key={state.slug} className="grid grid-cols-[minmax(88px,0.35fr)_minmax(0,1fr)] gap-3 rounded-xl border border-slate-100 bg-white p-3">
                          <dt className="text-xs font-semibold leading-5 text-slate-500">{state.job?.title || `Việc ${index + 1}`}</dt>
                          <dd className="min-w-0">{state.job ? <ExpandableValue value={row.value(state.job)} /> : <span className="text-slate-300">—</span>}</dd>
                        </div>
                      ))}
                    </dl>
                  </article>
                )
              })}
            </div>
          </section>
        ))}
      </div>
    </div>
  )
}

export default function JobComparisonWorkspace() {
  const [searchParams, setSearchParams] = useSearchParams()
  const { clearJobs, removeJob, replaceJobs } = useJobComparison()
  const rawQuery = searchParams.toString()
  const slugs = useMemo(
    () => parseComparisonSlugs(new URLSearchParams(rawQuery)),
    [rawQuery],
  )
  const queries = useQueries({
    queries: slugs.map((slug) => ({
      queryKey: jobKeys.detail(slug),
      queryFn: () => getJobDetail(slug),
      retry: (failureCount, error) => !isNotFound(error) && failureCount < 1,
    })),
  })
  const [onlyDifferences, setOnlyDifferences] = useState(false)
  const hydratedKeyRef = useRef('')
  const canonicalQuery = comparisonSearchParams(slugs).toString()
  const states = useMemo(
    () => slugs.map((slug, index) => ({ slug, query: queries[index], job: queries[index]?.data || null })),
    [queries, slugs],
  )
  const jobs = useMemo(() => states.map((state) => state.job).filter(Boolean), [states])
  const settled = states.every((state) => !state.query?.isPending)
  const hydratedKey = settled ? states.map((state) => state.job?.public_id || `!${state.slug}`).join('|') : ''

  useEffect(() => {
    if (rawQuery === canonicalQuery) return
    setSearchParams(comparisonSearchParams(slugs), { replace: true })
  }, [canonicalQuery, rawQuery, setSearchParams, slugs])

  useEffect(() => {
    if (!settled || !hydratedKey || hydratedKeyRef.current === hydratedKey) return
    hydratedKeyRef.current = hydratedKey
    replaceJobs(jobs)
  }, [hydratedKey, jobs, replaceJobs, settled])

  const groups = useMemo(() => COMPARISON_GROUPS
    .map((group) => ({
      ...group,
      rows: onlyDifferences ? group.rows.filter((row) => comparisonRowIsDifferent(row, jobs)) : group.rows,
    }))
    .filter((group) => group.rows.length), [jobs, onlyDifferences])

  function updateSlugs(nextSlugs) {
    setSearchParams(comparisonSearchParams(nextSlugs), { replace: true })
  }

  function handleRemove(slug) {
    removeJob(slug)
    updateSlugs(slugs.filter((current) => current !== slug))
  }

  function handleClear() {
    clearJobs()
    updateSlugs([])
  }

  async function handleCopyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href)
      message.success('Đã sao chép liên kết so sánh.')
    } catch {
      message.info('Bạn có thể sao chép liên kết trên thanh địa chỉ.')
    }
  }

  if (!slugs.length) {
    return (
      <main className="min-h-[60vh] bg-slate-50 px-4 py-10">
        <div className="mx-auto max-w-2xl rounded-2xl border border-slate-200 bg-white px-6 py-12 text-center shadow-sm">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-xl text-[var(--brand-primary)]"><PlusOutlined /></div>
          <h1 className="mt-4 text-2xl font-extrabold text-slate-900">Chưa có việc làm để so sánh</h1>
          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">Chọn từ hai đến ba việc làm để xem rõ điểm giống và khác nhau.</p>
          <Link to="/viec-lam" className="mt-6 inline-flex h-11 items-center justify-center rounded-lg !bg-[var(--brand-primary)] px-5 text-sm font-bold !text-white">Khám phá việc làm</Link>
        </div>
      </main>
    )
  }

  return (
    <main className="bg-slate-50 px-4 py-6 sm:py-8">
      <div className="mx-auto max-w-6xl">
        <nav className="text-sm text-slate-500"><Link to="/viec-lam" className="font-medium !text-slate-600 hover:!text-[var(--brand-primary)]">Việc làm</Link><span className="px-2 text-slate-300">›</span><span>So sánh việc làm</span></nav>
        <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">So sánh việc làm</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">Đối chiếu thông tin quan trọng để lựa chọn cơ hội phù hợp với ưu tiên của bạn.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={handleCopyLink} className="inline-flex h-11 items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-600 hover:border-slate-300 hover:text-slate-800"><CopyOutlined /> Sao chép liên kết</button>
            <Link to="/viec-lam" className="inline-flex h-11 items-center gap-2 rounded-lg border border-slate-200 !bg-white px-4 text-sm font-semibold !text-slate-600 hover:!border-emerald-300 hover:!text-[var(--brand-primary)]"><PlusOutlined /> Thêm việc khác</Link>
          </div>
        </div>

        {slugs.length < 2 && (
          <div role="status" className="mt-5 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">Chọn thêm ít nhất một việc làm để bắt đầu đối chiếu.</div>
        )}

        <div className="my-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
          <p className="text-sm font-semibold text-slate-700">Đang so sánh {slugs.length}/3 việc làm</p>
          <div className="flex items-center gap-4">
            <label className="inline-flex items-center gap-2 text-sm text-slate-600"><Switch size="small" checked={onlyDifferences} onChange={setOnlyDifferences} disabled={jobs.length < 2} /> Chỉ hiện điểm khác nhau</label>
            <button type="button" onClick={handleClear} className="text-sm font-semibold text-slate-500 hover:text-slate-800">Xóa tất cả</button>
          </div>
        </div>

        {onlyDifferences && groups.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white px-6 py-12 text-center text-sm text-slate-500 shadow-sm">Các tiêu chí hiện có đang giống nhau.</div>
        ) : (
          <>
            <DesktopMatrix groups={groups} states={states} jobs={jobs} onRemove={handleRemove} />
            <CompactMatrix groups={groups} states={states} jobs={jobs} onRemove={handleRemove} />
          </>
        )}
      </div>
    </main>
  )
}
