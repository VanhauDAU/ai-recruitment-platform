import { CheckOutlined, ReloadOutlined } from '@ant-design/icons'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Button, Empty, Result, Skeleton, Tooltip } from 'antd'
import {
  employerNotificationKeys,
  getEmployerNotifications,
  markAllEmployerNotificationsRead,
  markEmployerNotificationRead,
} from '@/entities/notification/employer-notification'
import { m } from '@/shared/config/i18n'
import useEventFeed from '../model/use-event-feed'
import { EventCategoryTabs, EventDayGroups, EventFeedFooter, EventRow } from './EventFeed'

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
  const markRead = (item) => !item.is_read && readMutation.mutate(item.public_id)

  return (
    <section className="ws-page" aria-labelledby="employer-notifications-title">
      <h1 id="employer-notifications-title" className="sr-only">{m.employer_workspace_title_notifications()}</h1>
      <div className="ws-panel">
        <EventCategoryTabs value={filters.category} counts={unreadCounts} onChange={(category) => setFilters({ category })} />
        <div className="ef-toolbar">
          <button
            type="button"
            aria-pressed={unreadOnly}
            className="ws-chip ws-tone-emerald"
            onClick={() => setFilters({ unread: unreadOnly ? '' : 'true' })}
          >
            <span aria-hidden className="ws-dot" />
            {m.employer_workspace_notifications_unread_only()}
            {unreadCounts && <span className="ws-chip__count">{unreadTotal}</span>}
          </button>
          <span className="ef-toolbar__meta">
            {hasFilters && <button type="button" className="ws-link-button" onClick={clearFilters}>{m.employer_workspace_clear_filters()}</button>}
            <Button
              size="small"
              icon={<CheckOutlined />}
              loading={readAllMutation.isPending}
              disabled={!unreadTotal}
              onClick={() => readAllMutation.mutate()}
            >
              {m.employer_workspace_notifications_mark_all_read()}
            </Button>
          </span>
        </div>
      </div>

      <div className="ws-panel ef-list" aria-busy={query.isFetching}>
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
                key={item.public_id}
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
                      size="small"
                      aria-label={m.employer_workspace_notifications_mark_read()}
                      icon={<CheckOutlined />}
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
