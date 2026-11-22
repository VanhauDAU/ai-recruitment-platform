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
import { EMPLOYER_EVENT_CATEGORIES } from '../model/event-filters'
import useEventFeed from '../model/use-event-feed'
import useSystemAnnouncements from '../model/use-system-announcements'
import {
  CategoryNav,
  EventDayGroups,
  EventFeedFooter,
  EventRow,
  FeedLayout,
  FeedSummary,
  FeedToolbar,
  Segmented,
} from './EventFeed'
import { AnnouncementHistory, PinnedAnnouncements } from './SystemAnnouncements'

const FILTER_KEYS = ['category', 'unread']
// Admin announcements live beside the event groups as their own "System" group.
const SYSTEM = 'system'
const NAV_ITEMS = [
  ...EMPLOYER_EVENT_CATEGORIES,
  { value: SYSTEM, countKey: SYSTEM, icon: 'bellRinging', label: m.employer_workspace_event_category_system() },
]
const VIEW_OPTIONS = [
  { value: '', label: m.employer_workspace_event_category_all() },
  { value: 'true', label: m.employer_workspace_notifications_unread_only() },
]

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
  const latest = !hasFilters && items[0]?.created_at
  const markRead = (item) => !item.is_read && readMutation.mutate(item.public_id)
  const announcements = useSystemAnnouncements()
  const showSystem = filters.category === SYSTEM
  const navCounts = unreadCounts && { ...unreadCounts, [SYSTEM]: announcements.live.length }

  return (
    <FeedLayout
      titleId="employer-notifications-title"
      title={m.employer_workspace_title_notifications()}
      side={(
        <>
          <FeedSummary
            eyebrow={m.employer_workspace_title_notifications()}
            value={unreadCounts ? unreadTotal : undefined}
            unit={m.employer_workspace_notifications_unread_unit()}
            hint={latest
              ? m.employer_workspace_feed_latest({ time: formatTimeAgo(latest, Date.now(), { inSentence: true }) })
              : m.employer_workspace_notifications_hero_hint()}
          >
            <Button
              icon={<DuotoneIcon name="checks" />}
              loading={readAllMutation.isPending}
              disabled={!unreadTotal}
              onClick={() => readAllMutation.mutate()}
              className="ef-summary__action"
            >
              {m.employer_workspace_notifications_mark_all_read()}
            </Button>
          </FeedSummary>
          <CategoryNav items={NAV_ITEMS} value={filters.category} counts={navCounts} onChange={(category) => setFilters({ category })} />
        </>
      )}
    >
      <FeedToolbar category={filters.category} title={showSystem ? m.employer_workspace_event_category_system() : undefined}>
        {hasFilters && <button type="button" className="ws-link-button" onClick={clearFilters}>{m.employer_workspace_clear_filters()}</button>}
        {!showSystem && (
          <Segmented
            label={m.employer_workspace_notifications_view_aria()}
            value={unreadOnly ? 'true' : ''}
            options={VIEW_OPTIONS}
            onChange={(unread) => setFilters({ unread })}
          />
        )}
      </FeedToolbar>
      {showSystem ? (
        <div aria-busy={announcements.query.isFetching}>
          {announcements.query.isPending && <div className="p-4"><Skeleton active avatar paragraph={{ rows: 3 }} /></div>}
          {announcements.query.isError && (
            <Result
              status="error"
              title={m.employer_workspace_notifications_load_error()}
              extra={<Button icon={<ReloadOutlined />} onClick={() => announcements.query.refetch()}>{m.employer_workspace_retry()}</Button>}
            />
          )}
          {announcements.query.isSuccess && (announcements.items.length
            ? <AnnouncementHistory items={announcements.items} />
            : <Empty className="py-12" image={Empty.PRESENTED_IMAGE_SIMPLE} description={m.employer_workspace_announcements_empty()} />)}
        </div>
      ) : (
        <div aria-busy={query.isFetching}>
          {!filters.category && !unreadOnly && <PinnedAnnouncements items={announcements.live} />}
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
      )}
    </FeedLayout>
  )
}
