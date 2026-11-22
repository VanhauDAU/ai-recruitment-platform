import { ReloadOutlined } from '@ant-design/icons'
import { Button, Empty, Result, Skeleton, Tooltip } from 'antd'
import { employerNotificationKeys, getEmployerActivities } from '@/entities/notification/employer-notification'
import { m, getIntlLocale } from '@/shared/config/i18n'
import { EMPLOYER_ACTIVITY_PERIODS } from '../model/event-filters'
import useEventFeed from '../model/use-event-feed'
import { CategoryTiles, EventDayGroups, EventFeedFooter, EventRow, FeedHero } from './EventFeed'

const FILTER_KEYS = ['category', 'days']
const dayFormat = new Intl.DateTimeFormat(getIntlLocale(), { day: '2-digit', month: '2-digit' })

/** Bars of the last 14 days (`daily_counts`), today highlighted. */
function ActivityChart({ days }) {
  if (!days?.length) return null
  const total = days.reduce((sum, day) => sum + day.count, 0)
  const peak = Math.max(...days.map((day) => day.count), 1)
  return (
    <div className="ef-chart">
      <div className="ef-chart__head">
        <span>{m.employer_workspace_activity_chart_title()}</span>
        <strong>{total}</strong>
      </div>
      <div role="img" aria-label={m.employer_workspace_activity_chart_aria({ total })} className="ef-chart__bars">
        {days.map((day, index) => (
          <Tooltip key={day.date} title={m.employer_workspace_activity_chart_day({ date: dayFormat.format(new Date(`${day.date}T00:00:00`)), count: day.count })}>
            <span
              className={`ef-chart__bar${day.count ? '' : ' is-empty'}${index === days.length - 1 ? ' is-today' : ''}`}
              style={{ height: `${Math.max(8, Math.round((day.count / peak) * 100))}%` }}
            />
          </Tooltip>
        ))}
      </div>
    </div>
  )
}

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
      <FeedHero
        icon="clockCounterClockwise"
        title={m.employer_workspace_activity_count({ count: total })}
        hint={m.employer_workspace_activity_hero_hint()}
        aside={<ActivityChart days={firstPage?.daily_counts} />}
      />
      <CategoryTiles value={filters.category} counts={firstPage?.category_counts} onChange={(category) => setFilters({ category })} />

      <div className="ws-panel ef-list" aria-busy={query.isFetching}>
        <div className="ef-toolbar">
          <div role="group" aria-label={m.employer_workspace_activity_period_aria()} className="ef-segmented">
            {EMPLOYER_ACTIVITY_PERIODS.map((period) => (
              <button
                key={period.value || 'all'}
                type="button"
                aria-pressed={filters.days === period.value}
                onClick={() => setFilters({ days: period.value })}
              >
                {period.label}
              </button>
            ))}
          </div>
          {hasFilters && (
            <span className="ef-toolbar__meta">
              <button type="button" className="ws-link-button" onClick={clearFilters}>{m.employer_workspace_clear_filters()}</button>
            </span>
          )}
        </div>
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
            variant="timeline"
            items={items}
            timeOf={(activity) => activity.occurred_at}
            renderRow={(activity) => (
              <EventRow
                variant="timeline"
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
