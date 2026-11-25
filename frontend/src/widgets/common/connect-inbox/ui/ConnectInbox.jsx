import { ProfileOutlined } from '@ant-design/icons'
import { useState } from 'react'
import { useNavigate } from 'react-router'
import { connectPath, useConversation } from '@/entities/messaging/conversation'
import { useSiteSettings } from '@/entities/system/site-settings'
import { ConversationList } from '@/features/common/messaging/browse-conversations'
import { Composer, ConversationHeader, MessageThread, useConnectRealtime } from '@/features/common/messaging/chat-conversation'
import { m } from '@/shared/config/i18n'
import { useMediaQuery } from '@/shared/hooks/use-media-query'
import BottomSheet from '@/shared/ui/BottomSheet'
import { Button, IconButton, SidePanel, Skeleton } from '@/shared/ui/connect-kit'
import './connect.css'

function ThreadPane({ portal, conversationId, onBack, contextButton, attachItems, renderCvActions, renderInterviewActions, typing }) {
  const query = useConversation(portal, conversationId)
  const conversation = query.data
  if (query.isPending) return <div className="pc-inbox__state"><Skeleton avatar rows={3} className="pc-inbox__skeleton" /></div>
  if (!conversation) {
    return (
      <div className="pc-inbox__state pc-note">
        <p>{m.connect_thread_not_found()}</p>
        {onBack && <Button variant="accent" onClick={onBack}>{m.connect_back_to_list()}</Button>}
      </div>
    )
  }
  return (
    <>
      <ConversationHeader conversation={conversation} onBack={onBack} extra={contextButton} />
      <MessageThread
        key={conversationId}
        portal={portal}
        conversation={conversation}
        typing={typing}
        renderCvActions={(message) => renderCvActions?.(message, conversation)}
        renderInterviewActions={(message) => renderInterviewActions?.(message, conversation)}
      />
      <Composer key={`composer-${conversationId}`} portal={portal} conversation={conversation} attachItems={attachItems?.(conversation) || []} />
    </>
  )
}

/**
 * ProCV Connect inbox for both portals. Desktop (≥1200px): list | chat | context;
 * tablet: list | chat with the context in a drawer; mobile: the route picks the
 * list or the chat, context in a bottom sheet. Portal specifics come in as slots:
 * `renderContext({ conversation })`, `attachItems(conversation)`,
 * `renderCvActions` / `renderInterviewActions(message, conversation)`.
 */
export default function ConnectInbox({
  portal,
  conversationId,
  emptyListHint,
  contextTitle,
  contextWithoutConversation = false,
  renderContext,
  ...slots
}) {
  const navigate = useNavigate()
  const { settings, loading } = useSiteSettings()
  const wide = useMediaQuery('(min-width: 1200px)')
  const medium = useMediaQuery('(min-width: 768px)')
  // Ngăn kéo ngữ cảnh gắn với hội thoại đã mở nó: đổi hội thoại là tự đóng.
  const [contextFor, setContextFor] = useState(null)
  const contextOpen = contextFor === (conversationId || '')
  const closeContext = () => setContextFor(null)
  const typingIn = useConnectRealtime({ portal, activeId: conversationId })
  const { data: conversation = null } = useConversation(portal, conversationId)

  if (settings.connect_enabled !== true) {
    return (
      <div className="pc-inbox pc-inbox--state">
        {loading ? <Skeleton rows={4} className="pc-inbox__skeleton" /> : <p className="pc-note">{m.connect_disabled()}</p>}
      </div>
    )
  }

  const hasContext = Boolean(renderContext) && (contextWithoutConversation || conversation)
  const contextButton = hasContext && !wide ? (
    <IconButton label={contextTitle} onClick={() => setContextFor(conversationId || '')}><ProfileOutlined /></IconButton>
  ) : null
  const showList = medium || !conversationId
  const showThread = medium || Boolean(conversationId)
  const context = hasContext ? renderContext({ conversation }) : null

  return (
    <div className={`pc-inbox${wide ? ' pc-inbox--wide' : ''}${medium ? ' pc-inbox--medium' : ''}`}>
      {showList && (
        <div className="pc-inbox__list">
          <ConversationList
            portal={portal}
            activeId={conversationId}
            emptyHint={emptyListHint}
            extra={contextWithoutConversation && !conversationId ? contextButton : null}
          />
        </div>
      )}
      {showThread && (
        <section className="pc-inbox__thread" aria-label={m.connect_thread_label()}>
          {conversationId ? (
            <ThreadPane
              {...slots}
              portal={portal}
              conversationId={conversationId}
              typing={typingIn === conversationId}
              onBack={medium ? null : () => navigate(connectPath(portal))}
              contextButton={contextButton}
            />
          ) : (
            <p className="pc-inbox__state pc-note">{m.connect_thread_pick()}</p>
          )}
        </section>
      )}
      {wide && hasContext && (
        <aside className="pc-inbox__context" aria-label={contextTitle}>
          <h2 className="pc-inbox__context-title">{contextTitle}</h2>
          <div className="pc-inbox__context-body">{context}</div>
        </aside>
      )}
      {!wide && hasContext && medium && (
        <SidePanel open={contextOpen} onClose={closeContext} title={contextTitle} closeLabel={m.connect_close()}>
          {context}
        </SidePanel>
      )}
      {!medium && hasContext && (
        <BottomSheet open={contextOpen} onClose={closeContext} title={contextTitle}>
          <div className="pc-inbox__sheet">{context}</div>
        </BottomSheet>
      )}
    </div>
  )
}
