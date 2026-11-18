import { Tooltip } from 'antd'
import { jobStatusMeta } from './job-list-presentation'

export default function JobStatusPill({ job }) {
  const status = jobStatusMeta(job)
  const reasons = (job.visibility_issues || []).map((issue) => issue.label).join(' ')
  return (
    <Tooltip title={reasons || null}>
      <span className={`job-pill job-tone-${status.tone}`}>{status.label}</span>
    </Tooltip>
  )
}
