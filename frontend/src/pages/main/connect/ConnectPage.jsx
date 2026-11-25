import { FileTextOutlined } from '@ant-design/icons'
import { useState } from 'react'
import { Link, useParams } from 'react-router'
import { useConnectUnreadCount } from '@/entities/messaging/conversation'
import { BrandLogo, useSiteSettings } from '@/entities/system/site-settings'
import { AppliedJobsPanel } from '@/features/main/messaging/browse-applied-jobs'
import { InterviewResponse } from '@/features/main/messaging/respond-interview'
import { ShareCvModal } from '@/features/main/messaging/share-cv'
import { m } from '@/shared/config/i18n'
import { ConnectInbox } from '@/widgets/common/connect-inbox'

/** ProCV Connect of the candidate: a compact full-height page outside the site chrome. */
export default function ConnectPage() {
  const { conversationId } = useParams()
  const [sharingCv, setSharingCv] = useState(null)
  // Toast + chuông cho tin của hội thoại khác (trang này không có header chung).
  useConnectUnreadCount('candidate', { enabled: useSiteSettings().settings.connect_enabled === true })

  return (
    <div className="connect-page">
      <header className="connect-page__bar">
        <BrandLogo variant="mark" to="/" imageClassName="h-8" />
        <strong className="connect-page__title">{m.connect_title()}</strong>
        <Link to="/" className="connect-page__home">{m.connect_back_home()}</Link>
      </header>
      <main className="connect-page__body">
        <ConnectInbox
          portal="candidate"
          conversationId={conversationId}
          emptyListHint={m.connect_candidate_empty_list()}
          contextTitle={m.connect_candidate_context_title()}
          contextWithoutConversation
          renderContext={() => <AppliedJobsPanel activeId={conversationId} />}
          attachItems={(conversation) => [
            { key: 'cv', icon: <FileTextOutlined />, label: m.connect_attach_cv(), onClick: () => setSharingCv(conversation) },
          ]}
          renderInterviewActions={(message, conversation) => <InterviewResponse conversation={conversation} message={message} />}
        />
      </main>
      {sharingCv && <ShareCvModal conversation={sharingCv} onClose={() => setSharingCv(null)} />}
    </div>
  )
}
