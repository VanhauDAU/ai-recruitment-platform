import { FireOutlined } from '@ant-design/icons'
import { companyInitial, formatSalary } from '@/entities/job'
import SearchDropdownEmpty from './SearchDropdownEmpty'

const MIN_SUGGESTED = 6

export default function SuggestedJobsSection({ jobs, loading, onSelect }) {
  return <div className="min-w-0 flex-1 p-4 md:min-w-[360px]"><div className="mb-3 flex items-center gap-1.5"><FireOutlined className="text-orange-400" /><span className="text-xs font-semibold uppercase tracking-wider text-gray-400">Việc làm có thể bạn quan tâm</span></div>{loading ? <ul className="space-y-1">{Array.from({ length: MIN_SUGGESTED }).map((_, index) => <li key={index} className="h-[54px] animate-pulse rounded-lg bg-gray-50" />)}</ul> : jobs.length === 0 ? <SearchDropdownEmpty /> : <ul className="space-y-1">{jobs.map((job) => <li key={job.public_id}><button onClick={() => onSelect(job)} className="group flex w-full cursor-pointer items-center gap-3 rounded-xl px-2.5 py-2 text-left transition-colors hover:bg-gray-50"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-50 to-emerald-100 text-sm font-bold text-[var(--brand-primary)] ring-1 ring-emerald-100">{companyInitial(job.company_name)}</div><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium text-gray-800 transition-colors group-hover:text-[var(--brand-primary)]">{job.title}</p><p className="truncate text-xs text-gray-400">{job.company_name}</p></div><span className="shrink-0 text-xs font-semibold text-[var(--brand-primary)]">{formatSalary(job)}</span></button></li>)}</ul>}</div>
}
