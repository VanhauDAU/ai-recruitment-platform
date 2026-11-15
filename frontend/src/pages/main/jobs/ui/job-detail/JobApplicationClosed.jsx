import { DoubleRightOutlined, ExclamationCircleFilled } from '@ant-design/icons'
import './job-application-closed.css'

function showRelatedJobs() {
  const section = document.getElementById('related-jobs')
  if (section) section.scrollIntoView({ behavior: 'smooth', block: 'start' })
  else window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'smooth' })
}

/** Shown in place of the apply button once the employer stopped recruiting. */
export default function JobApplicationClosed({ compact = false, className = '' }) {
  return (
    <div className={`job-closed${compact ? ' job-closed--compact' : ''} ${className}`}>
      <span className="job-closed__badge">
        <ExclamationCircleFilled aria-hidden="true" className="job-closed__badge-icon" />
        Hết hạn ứng tuyển
      </span>
      <button type="button" onClick={showRelatedJobs} className="job-closed__related">
        <span className="job-closed__related-label">Xem việc làm liên quan</span>
        <DoubleRightOutlined aria-hidden="true" className="job-closed__related-icon" />
      </button>
    </div>
  )
}
