import { useQuery } from '@tanstack/react-query'
import { Link, useNavigate } from 'react-router'
import { jobDetailPath } from '@/entities/job/job'
import {
  connectPath,
  conversationKeys,
  getConnectAppliedJobs,
  useStartConversation,
} from '@/entities/messaging/conversation'
import { m } from '@/shared/config/i18n'
import { Avatar, Pill, Skeleton } from '@/shared/ui/connect-kit'

/** Right column of the candidate inbox: jobs applied to, each with "Nhắn tin". */
export default function AppliedJobsPanel({ activeId }) {
  const navigate = useNavigate()
  const query = useQuery({ queryKey: conversationKeys.appliedJobs(), queryFn: getConnectAppliedJobs })
  const start = useStartConversation('candidate')
  const items = query.data || []

  if (query.isPending) return [0, 1, 2].map((key) => <Skeleton key={key} avatar rows={2} className="pc-context__skeleton" />)
  if (query.isError) return <p className="pc-note">{m.connect_applied_load_failed()}</p>
  if (!items.length) {
    return (
      <p className="pc-note">
        {m.connect_applied_empty()} <Link to="/viec-lam" className="pc-link">{m.connect_applied_find_jobs()}</Link>
      </p>
    )
  }
  return (
    <ul className="pc-context">
      {items.map((item) => {
        const conversationId = item.conversation_public_id
        return (
          <li key={item.application_public_id} className="pc-context__row">
            <Avatar src={item.company?.logo_url} name={item.company?.name} size={36} />
            <span className="pc-context__row-text">
              <Link to={jobDetailPath(item.job)} className="pc-context__row-title">{item.job.title}</Link>
              <span className="pc-context__row-sub">{item.company?.name}</span>
            </span>
            {conversationId === activeId && activeId ? (
              <Pill current>{m.connect_context_current()}</Pill>
            ) : conversationId ? (
              <Pill onClick={() => navigate(connectPath('candidate', conversationId))}>{m.connect_message_action()}</Pill>
            ) : item.can_start && (
              <Pill
                loading={start.isPending && start.variables?.job === item.job.public_id}
                onClick={() => start.mutate({ job: item.job.public_id })}
              >
                {m.connect_message_action()}
              </Pill>
            )}
          </li>
        )
      })}
    </ul>
  )
}
