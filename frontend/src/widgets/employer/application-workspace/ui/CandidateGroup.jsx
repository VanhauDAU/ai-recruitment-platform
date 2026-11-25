import { DownOutlined, LockOutlined, StopOutlined } from '@ant-design/icons'
import { FitScoreChip } from '@/entities/application/job-fit'
import { m } from '@/shared/config/i18n'
import { formatApplicationDate, initialsOf } from '../model/application-workspace'
import ApplicationStatusBadge from './ApplicationStatusBadge'

export default function CandidateGroup({ group, expanded, selectedPublicId, onToggle, onSelect }) {
  const active = group.applications.some((item) => item.public_id === selectedPublicId)
  const hasUnread = group.applications.some((item) => item.status === 'submitted')
  const blocked = group.applications.some((item) => item.candidate_blocked)
  return (
    <article className={`aw-group${active ? ' is-active' : ''}`}>
      <button
        type="button"
        className="flex w-full items-center gap-3 p-3 text-left transition hover:bg-slate-50"
        aria-expanded={expanded}
        aria-label={expanded
          ? m.employer_workspace_app_collapse_candidate({ name: group.candidateName })
          : m.employer_workspace_app_expand_candidate({ name: group.candidateName })}
        onClick={onToggle}
      >
        <span className="aw-avatar">{initialsOf(group.candidateName)}</span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5">
            <strong className="truncate text-sm text-slate-900">{group.candidateName}</strong>
            {hasUnread && <span className="aw-new-dot" title={m.employer_workspace_nav_has_unread_cv()} />}
            {group.restricted && <LockOutlined title={m.employer_workspace_app_account_restricted_short()} className="shrink-0 text-amber-500" />}
            {blocked && <StopOutlined title={m.employer_workspace_app_blocked()} aria-label={m.employer_workspace_app_blocked()} className="shrink-0 text-red-500" />}
          </span>
          <span className="mt-0.5 block truncate text-xs text-slate-500">
            {m.employer_workspace_app_cv_count({ count: group.applications.length })} · {group.candidateEmail || m.employer_workspace_app_no_email()}
          </span>
        </span>
        <DownOutlined className={`shrink-0 text-[10px] text-slate-400 transition-transform ${expanded ? 'rotate-180' : ''}`} />
      </button>

      {expanded && (
        <div className="space-y-1 border-t border-slate-100 bg-slate-50/70 p-1.5">
          {group.applications.map((application, index) => {
            const selected = application.public_id === selectedPublicId
            const cvTitle = application.submitted_cv_title || application.cv_title || m.employer_workspace_app_cv_fallback()
            return (
              <button
                key={application.public_id}
                type="button"
                aria-current={selected ? 'true' : undefined}
                aria-label={m.employer_workspace_app_view_cv({ cvTitle, name: group.candidateName })}
                className={`aw-application${application.status === 'submitted' ? ' is-unread' : ''}`}
                onClick={() => onSelect(application)}
              >
                <span className="flex items-start justify-between gap-2">
                  <strong className="aw-application__title line-clamp-2">{cvTitle}</strong>
                  <span className="shrink-0 text-[10px] font-semibold text-slate-400">
                    {m.employer_workspace_app_submission({ number: application.submission_number || group.applications.length - index })}
                  </span>
                </span>
                <span className="mt-0.5 block truncate text-[11px] text-slate-500">
                  {application.job_title || m.employer_workspace_app_job()}
                </span>
                <span className="mt-2 flex flex-wrap items-center justify-between gap-1.5">
                  <ApplicationStatusBadge status={application.status} />
                  <span className="text-[10px] text-slate-400">
                    {formatApplicationDate(application.applied_at)}
                  </span>
                </span>
                {application.ai_match_status && (
                  <span className="mt-1.5 block">
                    <FitScoreChip
                      status={application.ai_match_status}
                      score={application.ai_match_score}
                      level={application.ai_match_level}
                    />
                  </span>
                )}
              </button>
            )
          })}
        </div>
      )}
    </article>
  )
}
