import { SearchOutlined } from '@ant-design/icons'
import { useInfiniteQuery } from '@tanstack/react-query'
import { useRef, useState } from 'react'
import { Link } from 'react-router'
import { connectPath, conversationKeys, getConversations, messagePreview } from '@/entities/messaging/conversation'
import { useRealtimeOpen } from '@/shared/api/use-realtime'
import { m } from '@/shared/config/i18n'
import useDebouncedValue from '@/shared/hooks/use-debounced-value'
import { useIntersection } from '@/shared/hooks/use-intersection'
import { Avatar, Button, Skeleton } from '@/shared/ui/connect-kit'
import { formatConversationTime } from '../lib/conversation-time'
import ConversationMenu from './ConversationMenu'

const FALLBACK_POLL_MS = 60_000

function ConversationRow({ portal, conversation, active }) {
  const { counterpart = {}, job = {}, unread_count: unread } = conversation
  const name = counterpart.name || m.connect_counterpart_fallback()
  return (
    <li className="pc-conv-item">
      <Link
        to={connectPath(portal, conversation.public_id)}
        aria-current={active ? 'page' : undefined}
        className={`pc-conv${active ? ' pc-conv--active' : ''}${unread ? ' pc-conv--unread' : ''}`}
      >
        <Avatar src={counterpart.avatar_url} name={name} size={40} />
        <span className="pc-conv__body">
          <span className="pc-conv__line">
            <span className="pc-conv__name">{name}</span>
            <time className="pc-conv__time">{formatConversationTime(conversation.last_message_at || conversation.created_at)}</time>
          </span>
          <span className="pc-conv__job">{job.title}</span>
          <span className="pc-conv__line">
            <span className="pc-conv__preview">
              {conversation.last_message ? messagePreview(conversation.last_message, { myRole: conversation.my_role }) : m.connect_list_no_message()}
            </span>
            {unread > 0 && <span className="pc-conv__dot" role="img" aria-label={m.connect_list_unread({ count: unread })} />}
          </span>
        </span>
      </Link>
      <ConversationMenu portal={portal} conversation={conversation} active={active} />
    </li>
  )
}

/** Inbox column: search box and the newest conversations first, loading more on scroll. */
export default function ConversationList({ portal, activeId, emptyHint, extra }) {
  const [search, setSearch] = useState('')
  const q = useDebouncedValue(search.trim(), 350)
  const live = useRealtimeOpen()
  const scrollRef = useRef(null)
  const sentinelRef = useRef(null)
  const query = useInfiniteQuery({
    queryKey: conversationKeys.list(portal, q),
    queryFn: ({ pageParam }) => getConversations(portal, { q, page: pageParam }),
    initialPageParam: 1,
    getNextPageParam: (last, pages) => (last?.next ? pages.length + 1 : undefined),
    refetchInterval: live ? false : FALLBACK_POLL_MS,
  })
  const conversations = query.data?.pages.flatMap((page) => page.results || []) || []
  useIntersection(sentinelRef, () => query.fetchNextPage(), {
    rootRef: scrollRef,
    enabled: query.hasNextPage && !query.isFetchingNextPage,
  })

  return (
    <section className="pc-list" aria-label={m.connect_list_title()}>
      <div className="pc-list__head">
        <div className="pc-list__title-row">
          <h2 className="pc-list__title">{m.connect_list_title()}</h2>
          {extra}
        </div>
        <label className="pc-search">
          <SearchOutlined aria-hidden className="pc-search__icon" />
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={portal === 'employer' ? m.connect_list_search_employer() : m.connect_list_search_candidate()}
            aria-label={m.connect_list_search_label()}
            className="pc-search__input"
          />
        </label>
      </div>
      <div ref={scrollRef} className="pc-list__scroll">
        {query.isPending && [0, 1, 2, 3, 4].map((key) => <Skeleton key={key} avatar className="pc-list__skeleton" />)}
        {query.isError && (
          <div className="pc-note">
            <p>{m.connect_list_load_failed()}</p>
            <Button variant="accent" onClick={() => query.refetch()}>{m.connect_retry()}</Button>
          </div>
        )}
        {query.isSuccess && conversations.length === 0 && (
          <p className="pc-note">{q ? m.connect_list_no_match() : (emptyHint || m.connect_list_empty())}</p>
        )}
        {conversations.length > 0 && (
          <ul className="pc-list__items">
            {conversations.map((conversation) => (
              <ConversationRow
                key={conversation.public_id}
                portal={portal}
                conversation={conversation}
                active={conversation.public_id === activeId}
              />
            ))}
          </ul>
        )}
        <div ref={sentinelRef} aria-hidden className="pc-list__sentinel" />
        {query.isFetchingNextPage && <Skeleton avatar rows={1} className="pc-list__skeleton" />}
      </div>
    </section>
  )
}
