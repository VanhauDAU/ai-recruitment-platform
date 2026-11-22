import {
  FileTextOutlined,
  RightOutlined,
  SafetyCertificateOutlined,
  TeamOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons'
import { Button, Tooltip } from 'antd'
import { Fragment } from 'react'
import { Link } from 'react-router'
import { employerNotificationTone } from '@/entities/notification/employer-notification'
import { m } from '@/shared/config/i18n'
import { EMPLOYER_EVENT_CATEGORIES } from '../model/event-filters'
import { formatClockTime, formatDateTime, formatRelativeDay, localDayKey } from '@/shared/lib/date-time'
import '@/shared/ui/workspace-list/workspace-list.css'
import './event-feed.css'

const CATEGORY_ICONS = {
  applications: TeamOutlined,
  jobs: FileTextOutlined,
  campaigns: ThunderboltOutlined,
  company: SafetyCertificateOutlined,
}
// Event tones map onto `.ws-tone-*` of the shared list stylesheet.
const TONE_CLASSES = { success: 'emerald', warning: 'amber', danger: 'red', info: 'sky' }
const CATEGORY_LABELS = Object.fromEntries(EMPLOYER_EVENT_CATEGORIES.map((item) => [item.value, item.label]))

/** Status tabs of a feed: one per event group, with a server count. */
export function EventCategoryTabs({ value, counts, onChange }) {
  return (
    <div role="group" aria-label={m.employer_workspace_event_category_aria()} className="ws-tabs">
      {EMPLOYER_EVENT_CATEGORIES.map((tab) => {
        const count = counts?.[tab.countKey]
        return (
          <button key={tab.countKey} type="button" aria-pressed={value === tab.value} className="ws-tab" onClick={() => onChange(tab.value)}>
            {tab.label}
            {count === undefined
              ? <span aria-hidden className="ws-tab__count ws-tab__count--loading" />
              : <span className="ws-tab__count">{count}</span>}
          </button>
        )
      })}
    </div>
  )
}

/** Rows grouped under a sticky day heading ("Hôm nay", "Hôm qua", weekday). */
export function EventDayGroups({ items, timeOf, renderRow }) {
  return items.map((item, index) => {
    const day = localDayKey(timeOf(item))
    const startsDay = index === 0 || day !== localDayKey(timeOf(items[index - 1]))
    return (
      <Fragment key={item.public_id}>
        {startsDay && <h2 className="ef-day">{formatRelativeDay(timeOf(item))}</h2>}
        {renderRow(item)}
      </Fragment>
    )
  })
}

/**
 * One event: tone icon of its group, title linking to the related page,
 * optional message, then group label and extra meta. `unread` bolds the title.
 */
export function EventRow({ event, title, time, message, meta, unread = false, onOpen, actions }) {
  const Icon = CATEGORY_ICONS[event.category] || SafetyCertificateOutlined
  const tone = TONE_CLASSES[employerNotificationTone(event.event_type)]
  return (
    <article className={`ef-row${unread ? ' is-unread' : ''}`}>
      <span aria-hidden className={`ef-row__icon ws-tone-${tone}`}><Icon /></span>
      <div className="ef-row__body">
        <div className="ef-row__head">
          {event.action_path ? (
            <Link className="ef-row__title" to={event.action_path} onClick={() => onOpen?.(event)}>{title}</Link>
          ) : (
            <span className="ef-row__title">{title}</span>
          )}
          {unread && <span className="ef-row__dot" aria-label={m.ui_notification_unread()} />}
        </div>
        {message && <p className="ef-row__message">{message}</p>}
        <div className="ef-row__meta">
          <span>{CATEGORY_LABELS[event.category]}</span>
          {meta}
          <Tooltip title={formatDateTime(time)}>
            <time dateTime={time}>{formatClockTime(time)}</time>
          </Tooltip>
        </div>
      </div>
      <div className="ef-row__actions">
        {actions}
        {event.action_path && (
          // A wider click target for the title link; keyboard users reach the title.
          <Link aria-hidden tabIndex={-1} className="ef-row__open" to={event.action_path} onClick={() => onOpen?.(event)}>
            <RightOutlined />
          </Link>
        )}
      </div>
    </article>
  )
}

/** "Showing 20 of 54" with a button for the next page. */
export function EventFeedFooter({ shown, total, query }) {
  if (!total) return null
  return (
    <div className="ef-footer">
      <span>{m.employer_workspace_shown_of({ shown, total })}</span>
      {query.hasNextPage && (
        <Button size="small" loading={query.isFetchingNextPage} onClick={() => query.fetchNextPage()}>
          {m.employer_workspace_load_more()}
        </Button>
      )}
    </div>
  )
}
