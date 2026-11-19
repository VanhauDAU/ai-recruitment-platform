import { useQuery } from '@tanstack/react-query'
import { Skeleton } from 'antd'
import { applicationKeys, getRecruiterApplicationSubmissions } from '@/entities/application/application'
import { m } from '@/shared/config/i18n'
import { formatApplicationDate } from '../model/application-workspace'
import ApplicationStatusBadge from './ApplicationStatusBadge'

const FURTHEST_STAGE_LABELS = {
  viewed: m.employer_workspace_app_stage_viewed(),
  shortlisted: m.employer_workspace_app_stage_shortlisted(),
  interviewed: m.employer_workspace_app_stage_interviewed(),
  accepted: m.employer_workspace_app_stage_accepted(),
}

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
      <h3 className="aw-section__title">{m.employer_workspace_app_previous_submissions()}</h3>
      {query.isLoading && <Skeleton active paragraph={{ rows: 1 }} />}
      <ol className="m-0 list-none space-y-1.5 p-0">
        {items.map((item, index) => (
          <li key={item.public_id} className="flex items-center justify-between gap-2 rounded-lg bg-slate-50 px-2.5 py-2">
            <span className="min-w-0">
              <span className="block truncate text-xs font-semibold text-slate-700">
                {m.employer_workspace_app_submission({ number: application.submission_number - index - 1 })} · {item.submitted_cv_title || m.employer_workspace_app_cv_fallback()}
              </span>
              <span className="block text-[11px] text-slate-400">
                {m.employer_workspace_app_submitted_on({ date: formatApplicationDate(item.applied_at) })}
                {FURTHEST_STAGE_LABELS[item.furthest_stage] && ` · ${m.employer_workspace_app_reached_stage({ stage: FURTHEST_STAGE_LABELS[item.furthest_stage] })}`}
              </span>
            </span>
            <ApplicationStatusBadge status={item.status} />
          </li>
        ))}
      </ol>
    </section>
  )
}
