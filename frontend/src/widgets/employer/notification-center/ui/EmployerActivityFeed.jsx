import { ReloadOutlined } from '@ant-design/icons'
import { Button, Empty, Result, Skeleton, Tooltip } from 'antd'
import { employerNotificationKeys, getEmployerActivities } from '@/entities/notification/employer-notification'
import { m } from '@/shared/config/i18n'
import dayjs from '@/shared/lib/dayjs'
import { EMPLOYER_ACTIVITY_PERIODS } from '../model/event-filters'
import useEventFeed from '../model/use-event-feed'
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

const FILTER_KEYS = ['category', 'days']
const formatDay = (value) => dayjs(value).format('DD/MM')

/** Bars of the last 14 days (`daily_counts`); today in the accent color. */
function ActivitySpark({ days }) {
  if (!days?.length) return null
  const total = days.reduce((sum, day) => sum + day.count, 0)
  const peak = Math.max(...days.map((day) => day.count), 1)
  return (
    <div className="ef-spark">
      <div role="img" aria-label={m.employer_workspace_activity_chart_aria({ total })} className="ef-spark__bars">
        {days.map((day, index) => (
          <Tooltip key={day.date} title={m.employer_workspace_activity_chart_day({ date: formatDay(day.date), count: day.count })}>
            <span
              className={`ef-spark__bar${day.count ? '' : ' is-empty'}${index === days.length - 1 ? ' is-today' : ''}`}
              style={{ height: `${Math.max(8, Math.round((day.count / peak) * 100))}%` }}
            />
          </Tooltip>
        ))}
      </div>
      <div aria-hidden className="ef-spark__axis">
        <span>{formatDay(days[0].date)}</span>
        <span>{m.employer_workspace_activity_chart_title()}</span>
        <span>{formatDay(days.at(-1).date)}</span>
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
    <FeedLayout
      titleId="employer-activity-title"
      title={m.employer_workspace_title_activities()}
      side={(
        <>
          <FeedSummary
            eyebrow={m.employer_workspace_title_activities()}
            value={firstPage ? total : undefined}
            unit={m.employer_workspace_activity_unit()}
            hint={m.employer_workspace_activity_hero_hint()}
          >
            <ActivitySpark days={firstPage?.daily_counts} />
          </FeedSummary>
          <CategoryNav value={filters.category} counts={firstPage?.category_counts} onChange={(category) => setFilters({ category })} />
        </>
      )}
    >
      <FeedToolbar category={filters.category}>
        {hasFilters && <button type="button" className="ws-link-button" onClick={clearFilters}>{m.employer_workspace_clear_filters()}</button>}
        <Segmented
          label={m.employer_workspace_activity_period_aria()}
          value={filters.days}
          options={EMPLOYER_ACTIVITY_PERIODS}
          onChange={(days) => setFilters({ days })}
        />
      </FeedToolbar>
      <div aria-busy={query.isFetching}>
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
    </FeedLayout>
  )
}
