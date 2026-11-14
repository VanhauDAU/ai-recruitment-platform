import { Tooltip } from 'antd'
import { jobStatusMeta } from './job-list-presentation'

export default function JobStatusPill({ job }) {
  const status = jobStatusMeta(job)
  const hold = job.visibility_hold
  return (
    <Tooltip title={hold ? [hold.label, hold.reason_label].filter(Boolean).join(' · ') : null}>
      <span className={`job-pill job-tone-${status.tone}`}>{status.label}</span>
    </Tooltip>
  )
}
