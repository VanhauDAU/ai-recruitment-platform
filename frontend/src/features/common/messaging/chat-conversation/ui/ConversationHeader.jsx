import { ArrowLeftOutlined } from '@ant-design/icons'
import { m } from '@/shared/config/i18n'
import { Avatar, IconButton } from '@/shared/ui/connect-kit'

/** Counterpart and job of the open conversation; `onBack` shows the mobile back button. */
export default function ConversationHeader({ conversation, onBack, extra }) {
  const { counterpart = {}, job = {}, application } = conversation
  const name = counterpart.name || m.connect_counterpart_fallback()
  return (
    <header className="pc-thread-head">
      {onBack && <IconButton label={m.connect_back_to_list()} onClick={onBack}><ArrowLeftOutlined /></IconButton>}
      <Avatar src={counterpart.avatar_url} name={name} size={36} />
      <div className="pc-thread-head__text">
        <strong className="pc-thread-head__name">{name}</strong>
        <span className="pc-thread-head__job">{job.title}</span>
      </div>
      {(application?.status_label || job.stopped) && (
        <span className="pc-thread-head__status">{job.stopped ? m.connect_card_job_stopped() : application.status_label}</span>
      )}
      {extra}
    </header>
  )
}
