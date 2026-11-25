import { CalendarOutlined } from '@ant-design/icons'
import { Link } from 'react-router'
import { m } from '@/shared/config/i18n'
import { employerAppPath } from '@/shared/config/portals'
import { formatDateTime } from '@/shared/lib/date-time'
import { Button } from '@/shared/ui/connect-kit'

function Pair({ label, children }) {
  return (
    <div className="pc-pair">
      <dt className="pc-pair__label">{label}</dt>
      <dd className="pc-pair__value">{children}</dd>
    </div>
  )
}

/** Right column of the employer inbox: the job, the application and the interview shortcut. */
export default function ConversationContext({ conversation, onSchedule }) {
  if (!conversation) return null
  const { application, job = {}, counterpart = {} } = conversation
  return (
    <div className="pc-context">
      <dl className="pc-pairs">
        <Pair label={m.connect_context_candidate()}>{counterpart.name}</Pair>
        <Pair label={m.connect_context_job()}>
          <Link to={employerAppPath(`/jobs/${job.public_id}`)} className="pc-pair__link">{job.title}</Link>
        </Pair>
        {job.salary_text && <Pair label={m.connect_context_salary()}>{job.salary_text}</Pair>}
        {job.location_text && <Pair label={m.connect_context_location()}>{job.location_text}</Pair>}
        {job.stopped && <Pair label={m.connect_context_job_state()}>{m.connect_card_job_stopped()}</Pair>}
        <Pair label={m.connect_context_application()}>
          {application ? application.status_label : m.connect_context_no_application()}
        </Pair>
        <Pair label={m.connect_context_started_label()}>
          <span className="pc-tabular">{formatDateTime(conversation.created_at)}</span>
        </Pair>
      </dl>
      {application && (
        <Link to={`${employerAppPath('/applications')}?application=${encodeURIComponent(application.public_id)}`} className="pc-link pc-link--strong">
          {m.connect_context_open_application()}
        </Link>
      )}
      <Button variant="quiet" block disabled={!application || !conversation.can_send} onClick={onSchedule}>
        <CalendarOutlined aria-hidden /> {m.connect_attach_interview()}
      </Button>
    </div>
  )
}
