import { LockOutlined, StopOutlined } from '@ant-design/icons'
import { APPLICATION_STATUS_TONES, RECRUITER_APPLICATION_STATUS_LABELS } from '@/entities/application/application'
import { FitScoreChip } from '@/entities/application/job-fit'
import { m } from '@/shared/config/i18n'
import { formatApplicationDate, initialsOf } from '../model/application-workspace'

function cvTitleOf(application) {
  return application.submitted_cv_title || application.cv_title || m.employer_workspace_app_cv_fallback()
}

function Fit({ application }) {
  return (
    <FitScoreChip
      compact
      status={application.ai_match_status}
      score={application.ai_match_score}
      level={application.ai_match_level}
    />
  )
}

/** Trạng thái bằng chấm màu + chữ trầm, để danh sách dài không thành một dải nhãn màu. */
function Meta({ application, showSubmission }) {
  const { status } = application
  return (
    <span className="aw-row__meta">
      <span className={`aw-status aw-tone-${APPLICATION_STATUS_TONES[status] || 'slate'}`}>
        {RECRUITER_APPLICATION_STATUS_LABELS[status] || status || m.employer_workspace_app_status_unknown()}
      </span>
      {showSubmission && application.submission_number > 1 && (
        <span>{m.employer_workspace_app_submission({ number: application.submission_number })}</span>
      )}
      <span>{formatApplicationDate(application.applied_at)}</span>
    </span>
  )
}

function Flags({ group }) {
  const blocked = group.applications.some((item) => item.candidate_blocked)
  return (
    <>
      {group.restricted && <LockOutlined title={m.employer_workspace_app_account_restricted_short()} className="shrink-0 text-amber-500" />}
      {blocked && <StopOutlined title={m.employer_workspace_app_blocked()} aria-label={m.employer_workspace_app_blocked()} className="shrink-0 text-red-500" />}
    </>
  )
}

/**
 * Một ứng viên trong danh sách. Ứng viên chỉ có một CV là một dòng bấm được;
 * ứng viên có nhiều CV hiện tên một lần, các CV xếp ngay bên dưới.
 * `jobFiltered`: đang lọc theo một tin nên dòng phụ hiện tên CV thay vì tên tin.
 */
export default function CandidateGroup({ group, selectedPublicId, jobFiltered, onSelect }) {
  const { candidateName, applications } = group
  const labelOf = (application) => (jobFiltered ? cvTitleOf(application) : application.job_title || m.employer_workspace_app_job())
  const rowProps = (application) => {
    const selected = application.public_id === selectedPublicId
    return {
      type: 'button',
      'aria-current': selected ? 'true' : undefined,
      'aria-label': m.employer_workspace_app_view_cv({ cvTitle: cvTitleOf(application), name: candidateName }),
      className: `aw-row${application.status === 'submitted' ? ' is-unread' : ''}`,
      onClick: () => onSelect(application),
    }
  }

  if (applications.length === 1) {
    const [application] = applications
    return (
      <li>
        <button {...rowProps(application)}>
          <span className="aw-avatar" aria-hidden>{initialsOf(candidateName)}</span>
          <span className="aw-row__body">
            <span className="aw-row__top">
              <strong className="aw-row__name">{candidateName}</strong>
              <Flags group={group} />
              <Fit application={application} />
            </span>
            <span className="aw-row__sub">{labelOf(application)}</span>
            <Meta application={application} showSubmission />
          </span>
        </button>
      </li>
    )
  }

  const unread = applications.some((item) => item.status === 'submitted')
  return (
    <li className="aw-group">
      <div className={`aw-group__head${unread ? ' is-unread' : ''}`}>
        <span className="aw-avatar" aria-hidden>{initialsOf(candidateName)}</span>
        <strong className="aw-row__name">{candidateName}</strong>
        <Flags group={group} />
        <span className="aw-group__count">{m.employer_workspace_app_cv_count({ count: applications.length })}</span>
      </div>
      <ul className="aw-group__items" aria-label={m.employer_workspace_app_candidate_cvs({ name: candidateName })}>
        {applications.map((application) => (
          <li key={application.public_id}>
            <button {...rowProps(application)}>
              <span className="aw-row__body">
                <span className="aw-row__top">
                  <span className="aw-row__title">{labelOf(application)}</span>
                  <Fit application={application} />
                </span>
                <Meta application={application} showSubmission />
              </span>
            </button>
          </li>
        ))}
      </ul>
    </li>
  )
}
