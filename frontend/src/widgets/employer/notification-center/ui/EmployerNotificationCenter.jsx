import { ReloadOutlined } from '@ant-design/icons'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Button, Empty, Result, Skeleton, Tooltip } from 'antd'
import {
  employerNotificationKeys,
  getEmployerNotifications,
  markAllEmployerNotificationsRead,
  markEmployerNotificationRead,
} from '@/entities/notification/employer-notification'
import { m } from '@/shared/config/i18n'
import { formatTimeAgo } from '@/shared/lib/date-time'
import DuotoneIcon from '@/shared/ui/icons/DuotoneIcon'
import useEventFeed from '../model/use-event-feed'
import { CategoryTiles, EventDayGroups, EventFeedFooter, EventRow, FeedHero } from './EventFeed'

const FILTER_KEYS = ['category', 'unread']

export default function EmployerNotificationCenter() {
  const queryClient = useQueryClient()
  const { filters, setFilters, clearFilters, query, items, firstPage } = useEventFeed({
    filterKeys: FILTER_KEYS,
    queryKey: employerNotificationKeys.feed,
    fetchPage: getEmployerNotifications,
  })
  // The bell badge, its preview and this page all read the same cache.
  const invalidate = () => queryClient.invalidateQueries({ queryKey: employerNotificationKeys.all })
  const readMutation = useMutation({ mutationFn: markEmployerNotificationRead, onSuccess: invalidate })
  const readAllMutation = useMutation({ mutationFn: markAllEmployerNotificationsRead, onSuccess: invalidate })
  const unreadCounts = firstPage?.unread_counts
  const unreadTotal = unreadCounts?.all || 0
  const total = firstPage?.count || 0
  const unreadOnly = filters.unread === 'true'
  const hasFilters = Boolean(filters.category || unreadOnly)
  const latest = items[0]?.created_at
  const markRead = (item) => !item.is_read && readMutation.mutate(item.public_id)

  return (
    <section className="ws-page" aria-labelledby="employer-notifications-title">
      <h1 id="employer-notifications-title" className="sr-only">{m.employer_workspace_title_notifications()}</h1>
      <FeedHero
        icon="bellRinging"
        title={unreadTotal
          ? m.employer_workspace_notifications_unread_title({ count: unreadTotal })
          : m.employer_workspace_notifications_all_read()}
        hint={latest && !hasFilters
          ? `${m.employer_workspace_notifications_hero_hint()} ${m.employer_workspace_feed_latest({ time: formatTimeAgo(latest, Date.now(), { inSentence: true }) })}.`
          : m.employer_workspace_notifications_hero_hint()}
        aside={(
          <Button
            type="primary"
            icon={<DuotoneIcon name="checks" />}
            loading={readAllMutation.isPending}
            disabled={!unreadTotal}
            onClick={() => readAllMutation.mutate()}
            className="ef-hero__button"
          >
            {m.employer_workspace_notifications_mark_all_read()}
          </Button>
        )}
      />
      <CategoryTiles value={filters.category} counts={unreadCounts} onChange={(category) => setFilters({ category })} />

      <div className="ws-panel ef-list" aria-busy={query.isFetching}>
        <div className="ef-toolbar">
          <div className="ef-segmented">
            <button type="button" aria-pressed={!unreadOnly} onClick={() => setFilters({ unread: '' })}>
              {m.employer_workspace_event_category_all()}
            </button>
            <button type="button" aria-pressed={unreadOnly} onClick={() => setFilters({ unread: 'true' })}>
              {m.employer_workspace_notifications_unread_only()}
            </button>
          </div>
          <span className="ef-toolbar__meta">
            {!query.isPending && <span className="ws-quick__count">{m.employer_workspace_shown_of({ shown: items.length, total })}</span>}
            {hasFilters && <button type="button" className="ws-link-button" onClick={clearFilters}>{m.employer_workspace_clear_filters()}</button>}
          </span>
        </div>
        {query.isPending && <div className="p-4"><Skeleton active avatar paragraph={{ rows: 4 }} /></div>}
        {query.isError && (
          <Result
            status="error"
            title={m.employer_workspace_notifications_load_error()}
            extra={<Button icon={<ReloadOutlined />} onClick={() => query.refetch()}>{m.employer_workspace_retry()}</Button>}
          />
        )}
        {!query.isPending && !query.isError && items.length === 0 && (
          <Empty
            className="py-12"
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={unreadOnly
              ? m.employer_workspace_notifications_all_read()
              : hasFilters ? m.employer_workspace_notifications_empty_filtered() : m.employer_workspace_notifications_empty()}
          >
            {hasFilters && <Button onClick={clearFilters}>{m.employer_workspace_clear_filters()}</Button>}
          </Empty>
        )}
        <div className={query.isPlaceholderData ? 'opacity-60 transition-opacity' : undefined}>
          <EventDayGroups
            items={items}
            timeOf={(item) => item.created_at}
            renderRow={(item) => (
              <EventRow
                event={item}
                title={item.title}
                message={item.message}
                time={item.created_at}
                unread={!item.is_read}
                onOpen={markRead}
                actions={!item.is_read && (
                  <Tooltip title={m.employer_workspace_notifications_mark_read()}>
                    <Button
                      type="text"
                      aria-label={m.employer_workspace_notifications_mark_read()}
                      icon={<DuotoneIcon name="check" />}
                      loading={readMutation.isPending && readMutation.variables === item.public_id}
                      onClick={() => markRead(item)}
                      className="ef-mark-read"
                    />
                  </Tooltip>
                )}
              />
            )}
          />
        </div>
        <EventFeedFooter shown={items.length} total={total} query={query} />
      </div>
    </section>
  )
}
