import { CalendarOutlined, FileTextOutlined } from '@ant-design/icons'
import { useState } from 'react'
import { useParams } from 'react-router'
import { InterviewCardActions, ScheduleInterviewModal } from '@/features/employer/messaging/manage-interview'
import { SharedCvExport } from '@/features/employer/messaging/export-shared-cv'
import { ShareJobModal } from '@/features/employer/messaging/share-job'
import { m } from '@/shared/config/i18n'
import { ConnectInbox } from '@/widgets/common/connect-inbox'
import ConversationContext from './ui/ConversationContext'

/** ProCV Connect inside the employer workspace; fills the area under the route bar. */
export default function EmployerConnectPage() {
  const { conversationId } = useParams()
  const [dialog, setDialog] = useState(null)
  const close = () => setDialog(null)

  return (
    <div className="employer-connect">
      <ConnectInbox
        portal="employer"
        conversationId={conversationId}
        emptyListHint={m.connect_employer_empty_list()}
        contextTitle={m.connect_employer_context_title()}
        renderContext={({ conversation }) => (
          <ConversationContext conversation={conversation} onSchedule={() => setDialog({ type: 'interview', conversation })} />
        )}
        attachItems={(conversation) => [
          { key: 'job', icon: <FileTextOutlined />, label: m.connect_attach_job(), onClick: () => setDialog({ type: 'job', conversation }) },
          {
            key: 'interview',
            icon: <CalendarOutlined />,
            label: m.connect_attach_interview(),
            disabled: !conversation.application,
            onClick: () => setDialog({ type: 'interview', conversation }),
          },
        ]}
        renderInterviewActions={(message, conversation) => (
          <InterviewCardActions
            conversation={conversation}
            message={message}
            onReschedule={(interview) => setDialog({ type: 'interview', conversation, previous: interview })}
          />
        )}
        renderCvActions={(message, conversation) => <SharedCvExport conversation={conversation} message={message} />}
      />
      {dialog?.type === 'job' && <ShareJobModal conversation={dialog.conversation} onClose={close} />}
      {dialog?.type === 'interview' && (
        <ScheduleInterviewModal conversation={dialog.conversation} previous={dialog.previous} onClose={close} />
      )}
    </div>
  )
}
