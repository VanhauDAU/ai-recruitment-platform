import { Alert } from 'antd'
import { Link } from 'react-router'
import { employerReadinessAction } from '@/entities/account/employer-profile'
import { employerAppPath } from '@/shared/config/portals'
import { m } from '@/shared/config/i18n'

// Holds by an administrator keep their own alert; extending is a header action.
const SKIPPED_CODES = new Set(['moderation_hold', 'account_hold'])

function issueLink(issue, job) {
  if (issue.action === 'extend_deadline') return null
  if (issue.action === 'open_campaign') {
    return job.campaign ? { label: m.employer_job_visibility_open_campaign(), to: employerAppPath(`/chien-dich/${job.campaign}`) } : null
  }
  return employerReadinessAction(issue.action)
}

/** Every reason candidates cannot see a job, each with the way to fix it. */
export default function JobVisibilityIssuesAlert({ job }) {
  const issues = (job.visibility_issues || []).filter((issue) => !SKIPPED_CODES.has(issue.code))
  if (job.effective_state !== 'hidden' || issues.length === 0) return null
  return (
    <Alert
      type="warning"
      showIcon
      data-testid="job-visibility-issues"
      title={m.employer_job_visibility_title()}
      description={(
        <ul className="m-0 list-disc space-y-1 pl-4">
          {issues.map((issue) => {
            const link = issueLink(issue, job)
            return (
              <li key={issue.code}>
                {issue.label}
                {link && <> <Link className="font-semibold" to={link.to}>{link.label}</Link></>}
              </li>
            )
          })}
        </ul>
      )}
    />
  )
}
