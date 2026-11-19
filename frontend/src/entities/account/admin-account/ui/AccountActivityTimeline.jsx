import {
  BankOutlined,
  FileProtectOutlined,
  SafetyOutlined,
  SolutionOutlined,
  UserOutlined,
} from '@ant-design/icons'
import { Alert, Button, Empty, Skeleton } from 'antd'
import { useMemo } from 'react'
import { useSearchParams } from 'react-router'
import { formatClockTime, formatDateTime } from '@/shared/lib/date-time'
import { getApiErrorMessage } from '@/shared/api/error-mapper'
import {
  ACTIVITY_ACTOR_LABELS,
  ACTIVITY_CATEGORIES,
  ACTIVITY_CATEGORY_LABELS,
  groupActivityByDay,
  parseActivityCategory,
} from '../model/activity-timeline'
import useAccountActivity from '../model/use-account-activity'
import './account-activity-timeline.css'

const CATEGORY_ICONS = {
  security: <SafetyOutlined />,
  account: <UserOutlined />,
  verification: <FileProtectOutlined />,
  company: <BankOutlined />,
  recruitment: <SolutionOutlined />,
}

function EntryDetails({ details }) {
  if (!details?.length) return null
  return (
    <details className="activity-entry__details">
      <summary>Chi tiết</summary>
      <dl>
        {details.map((item) => (
          <div key={item.label}>
            <dt>{item.label}</dt>
            <dd>{item.type === 'datetime' ? formatDateTime(item.value) : item.value}</dd>
          </div>
        ))}
      </dl>
    </details>
  )
}

function ActivityEntry({ entry }) {
  const actor = entry.actor || {}
  return (
    <li className={`activity-entry activity-entry--${entry.tone}`}>
      <time className="activity-entry__time" dateTime={entry.occurred_at} title={formatDateTime(entry.occurred_at)}>
        {formatClockTime(entry.occurred_at)}
      </time>
      <span className={`activity-entry__dot activity-entry__dot--${entry.category}`} aria-hidden="true">
        {CATEGORY_ICONS[entry.category]}
      </span>
      <div className="activity-entry__main">
        <div className="activity-entry__head">
          <strong>{entry.title}</strong>
          <span className="activity-entry__category">{ACTIVITY_CATEGORY_LABELS[entry.category]}</span>
        </div>
        {entry.summary && <p className="activity-entry__summary">{entry.summary}</p>}
        <p className="activity-entry__actor">
          <span className={`activity-entry__badge activity-entry__badge--${actor.type}`}>
            {ACTIVITY_ACTOR_LABELS[actor.type] || 'Hệ thống'}
          </span>
          {actor.type === 'admin' || actor.type === 'member' ? <span>{actor.label}</span> : null}
        </p>
        <EntryDetails details={entry.details} />
      </div>
    </li>
  )
}

/**
 * Account activity grouped by day, newest first, filterable by category.
 * `compact` shows the latest entries only (overview, quick view) without
 * filters or paging.
 */
export default function AccountActivityTimeline({ compact = false, limit, publicId }) {
  const [searchParams, setSearchParams] = useSearchParams()
  const category = compact ? '' : parseActivityCategory(searchParams.get('activity_category'))
  const activity = useAccountActivity(publicId, { category, limit: limit || (compact ? 5 : 30) })
  const groups = useMemo(() => groupActivityByDay(activity.entries), [activity.entries])

  const selectCategory = (next) => {
    setSearchParams((current) => {
      const params = new URLSearchParams(current)
      if (next) params.set('activity_category', next)
      else params.delete('activity_category')
      return params
    }, { replace: true })
  }

  return (
    <section className={`activity-timeline${compact ? ' activity-timeline--compact' : ''}`} aria-label="Nhật ký hoạt động">
      {!compact && (
        <div className="activity-timeline__filters" role="group" aria-label="Lọc nhật ký theo nhóm">
          {[{ key: '', label: 'Tất cả' }, ...ACTIVITY_CATEGORIES].map((item) => (
            <button
              aria-pressed={category === item.key}
              className="activity-timeline__chip"
              key={item.key || 'all'}
              onClick={() => selectCategory(item.key)}
              type="button"
            >
              {item.label}
              {activity.counts && (
                <span className="activity-timeline__count">{activity.counts[item.key || 'all'] ?? 0}</span>
              )}
            </button>
          ))}
        </div>
      )}
      {activity.isLoading && <Skeleton active paragraph={{ rows: compact ? 3 : 6 }} title={false} />}
      {activity.isError && (
        <Alert
          showIcon
          type="error"
          title={getApiErrorMessage(activity.error, 'Không tải được nhật ký hoạt động.')}
          action={<Button size="small" onClick={() => activity.refetch()}>Thử lại</Button>}
        />
      )}
      {activity.isSuccess && groups.length === 0 && (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={category ? 'Chưa có hoạt động trong nhóm này' : 'Chưa có hoạt động nào được ghi nhận'}
        />
      )}
      {groups.map((group) => (
        <section className="activity-day" key={group.key} aria-label={group.label}>
          <h3 className="activity-day__label">
            {group.label}
            <span>{`${group.entries.length} hoạt động`}</span>
          </h3>
          <ol className="activity-day__list">
            {group.entries.map((entry) => <ActivityEntry entry={entry} key={entry.id} />)}
          </ol>
        </section>
      ))}
      {!compact && activity.hasNextPage && (
        <Button
          block
          className="activity-timeline__more"
          loading={activity.isFetchingNextPage}
          onClick={() => activity.fetchNextPage()}
        >
          {activity.isFetchingNextPage ? 'Đang tải…' : 'Tải thêm hoạt động cũ hơn'}
        </Button>
      )}
    </section>
  )
}
