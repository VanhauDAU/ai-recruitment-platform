import { ReloadOutlined } from '@ant-design/icons'
import { Button, Empty, Result, Skeleton } from 'antd'
import { employerNotificationKeys, getEmployerActivities } from '@/entities/notification/employer-notification'
import { m } from '@/shared/config/i18n'
import { EMPLOYER_ACTIVITY_PERIODS } from '../model/event-filters'
import useEventFeed from '../model/use-event-feed'
import { EventCategoryTabs, EventDayGroups, EventFeedFooter, EventRow } from './EventFeed'

const FILTER_KEYS = ['category', 'days']

export default function EmployerActivityFeed() {
  const { filters, setFilters, clearFilters, query, items, firstPage } = useEventFeed({
    filterKeys: FILTER_KEYS,
    queryKey: employerNotificationKeys.activityList,
    fetchPage: getEmployerActivities,
  })
  const total = firstPage?.count || 0
  const hasFilters = Boolean(filters.category || filters.days)

  return (
    <section className="ws-page" aria-labelledby="employer-activity-title">
      <h1 id="employer-activity-title" className="sr-only">{m.employer_workspace_title_activities()}</h1>
      <div className="ws-panel">
        <EventCategoryTabs value={filters.category} counts={firstPage?.category_counts} onChange={(category) => setFilters({ category })} />
        <div className="ef-toolbar">
          <div role="group" aria-label={m.employer_workspace_activity_period_aria()} className="ws-quick__chips">
            {EMPLOYER_ACTIVITY_PERIODS.map((period) => (
              <button
                key={period.value || 'all'}
                type="button"
                aria-pressed={filters.days === period.value}
                className="ws-chip ws-tone-emerald"
                onClick={() => setFilters({ days: period.value })}
              >
                {period.label}
              </button>
            ))}
          </div>
          <span className="ef-toolbar__meta">
            {!query.isPending && <span className="ws-quick__count">{m.employer_workspace_activity_count({ count: total })}</span>}
            {hasFilters && <button type="button" className="ws-link-button" onClick={clearFilters}>{m.employer_workspace_clear_filters()}</button>}
          </span>
        </div>
      </div>

      <div className="ws-panel ef-list" aria-busy={query.isFetching}>
        {query.isPending && <div className="p-4"><Skeleton active avatar paragraph={{ rows: 4 }} /></div>}
        {query.isError && (
          <Result
            status="error"
            title={m.employer_workspace_activity_load_error()}
            extra={<Button icon={<ReloadOutlined />} onClick={() => query.refetch()}>{m.employer_workspace_retry()}</Button>}
          />
        )}
        {!query.isPending && !query.isError && items.length === 0 && (
          <Empty
            className="py-12"
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={hasFilters ? m.employer_workspace_activity_empty_filtered() : m.employer_workspace_activity_empty()}
          >
            {hasFilters && <Button onClick={clearFilters}>{m.employer_workspace_clear_filters()}</Button>}
          </Empty>
        )}
        <div className={query.isPlaceholderData ? 'opacity-60 transition-opacity' : undefined}>
          <EventDayGroups
            items={items}
            timeOf={(activity) => activity.occurred_at}
            renderRow={(activity) => (
              <EventRow
                key={activity.public_id}
                event={activity}
                title={activity.summary}
                time={activity.occurred_at}
                meta={<span>{activity.actor_name}</span>}
              />
            )}
          />
        </div>
        <EventFeedFooter shown={items.length} total={total} query={query} />
      </div>
    </section>
  )
}
