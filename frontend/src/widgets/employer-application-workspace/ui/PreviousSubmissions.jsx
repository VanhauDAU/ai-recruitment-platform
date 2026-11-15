import { useQuery } from '@tanstack/react-query'
import { Skeleton } from 'antd'
import { applicationKeys, getRecruiterApplicationSubmissions } from '@/entities/application'
import { formatApplicationDate } from '../model/application-workspace'
import ApplicationStatusBadge from './ApplicationStatusBadge'

/** Earlier submissions this one replaced: how each ended, read-only. */
export default function PreviousSubmissions({ application }) {
  const hasEarlier = (application.submission_number || 1) > 1
  const query = useQuery({
    queryKey: applicationKeys.submissions(application.public_id),
    queryFn: () => getRecruiterApplicationSubmissions(application.public_id),
    enabled: hasEarlier,
  })
  if (!hasEarlier) return null
  const items = Array.isArray(query.data) ? query.data : []
  return (
    <section className="aw-section space-y-2">
      <h3 className="aw-section__title">Các lần nộp trước</h3>
      {query.isLoading && <Skeleton active paragraph={{ rows: 1 }} />}
      <ol className="m-0 list-none space-y-1.5 p-0">
        {items.map((item, index) => (
          <li key={item.public_id} className="flex items-center justify-between gap-2 rounded-lg bg-slate-50 px-2.5 py-2">
            <span className="min-w-0">
              <span className="block truncate text-xs font-semibold text-slate-700">
                Lần {application.submission_number - index - 1} · {item.submitted_cv_title || 'CV ứng viên'}
              </span>
              <span className="block text-[11px] text-slate-400">Nộp {formatApplicationDate(item.applied_at)}</span>
            </span>
            <ApplicationStatusBadge status={item.status} />
          </li>
        ))}
      </ol>
    </section>
  )
}
