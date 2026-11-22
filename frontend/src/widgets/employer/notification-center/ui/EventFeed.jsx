import { Button, Tooltip } from 'antd'
import { Fragment } from 'react'
import { Link } from 'react-router'
import { employerNotificationTone } from '@/entities/notification/employer-notification'
import { m } from '@/shared/config/i18n'
import {
  formatClockTime,
  formatDateTime,
  formatRelativeDay,
  formatTimeAgo,
  localDayKey,
} from '@/shared/lib/date-time'
import DuotoneIcon from '@/shared/ui/icons/DuotoneIcon'
import { EMPLOYER_EVENT_CATEGORIES, EVENT_ICONS } from '../model/event-filters'
import '@/shared/ui/workspace-list/workspace-list.css'
import './event-feed.css'

// Event severities map onto `.ws-tone-*` of the shared list stylesheet.
const SEVERITY_TONES = { success: 'emerald', warning: 'amber', danger: 'red', info: 'sky' }
const CATEGORIES = Object.fromEntries(EMPLOYER_EVENT_CATEGORIES.map((item) => [item.value, item]))

/** Summary card on top of a feed: icon, a sentence of status and side content. */
export function FeedHero({ icon, title, hint, aside }) {
  return (
    <div className="ef-hero">
      <div className="ef-hero__main">
        <span aria-hidden className="ef-hero__icon"><DuotoneIcon name={icon} /></span>
        <div className="ef-hero__text">
          <p className="ef-hero__title">{title}</p>
          <p className="ef-hero__hint">{hint}</p>
        </div>
      </div>
      {aside && <div className="ef-hero__aside">{aside}</div>}
    </div>
  )
}

/** One tile per event group; the selected tile filters the feed. */
export function CategoryTiles({ value, counts, onChange }) {
  const total = counts?.all || 0
  return (
    <div role="group" aria-label={m.employer_workspace_event_category_aria()} className="ef-tiles">
      {EMPLOYER_EVENT_CATEGORIES.map((tile) => {
        const count = counts?.[tile.countKey]
        return (
          <button
            key={tile.countKey}
            type="button"
            aria-pressed={value === tile.value}
            className={`ef-tile ws-tone-${tile.tone}`}
            onClick={() => onChange(tile.value)}
          >
            <span className="ef-tile__top">
              <span aria-hidden className="ef-tile__icon"><DuotoneIcon name={tile.icon} /></span>
              {count === undefined
                ? <span aria-hidden className="ef-tile__count ef-tile__count--loading" />
                : <span className="ef-tile__count">{count}</span>}
            </span>
            <span className="ef-tile__label">{tile.label}</span>
            {tile.value && (
              <span aria-hidden className="ef-tile__bar">
                <span style={{ width: `${total ? Math.round(((count || 0) / total) * 100) : 0}%` }} />
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}

/** Rows under sticky day labels ("Hôm nay", "Hôm qua", weekday). */
export function EventDayGroups({ items, timeOf, renderRow, variant = 'cards' }) {
  const groups = []
  items.forEach((item) => {
    const day = localDayKey(timeOf(item))
    if (groups.at(-1)?.day !== day) groups.push({ day, items: [] })
    groups.at(-1).items.push(item)
  })
  return groups.map((group) => (
    <section key={group.day} className="ef-group">
      <h2 className="ef-day">{formatRelativeDay(timeOf(group.items[0]))}</h2>
      <div className={variant === 'timeline' ? 'ef-timeline' : 'ef-cards'}>
        {group.items.map((item) => <Fragment key={item.public_id}>{renderRow(item)}</Fragment>)}
      </div>
    </section>
  ))
}

function EventTime({ time }) {
  const today = localDayKey(time) === localDayKey(new Date())
  return (
    <Tooltip title={formatDateTime(time)}>
      <time dateTime={time}>{today ? formatTimeAgo(time) : formatClockTime(time)}</time>
    </Tooltip>
  )
}

/**
 * One event: what happened (icon tinted by severity), the title linking to
 * the page that handles it, an optional message, then group and meta.
 */
export function EventRow({ event, title, time, message, meta, unread = false, onOpen, actions, variant = 'cards' }) {
  const category = CATEGORIES[event.category] || CATEGORIES.company
  const tone = SEVERITY_TONES[employerNotificationTone(event.event_type)]
  return (
    <article className={`ef-row ef-row--${variant} ws-tone-${tone}${unread ? ' is-unread' : ''}`}>
      <span aria-hidden className="ef-row__icon">
        <DuotoneIcon name={EVENT_ICONS[event.event_type] || category.icon} />
      </span>
      <div className="ef-row__body">
        <div className="ef-row__head">
          {event.action_path
            ? <Link className="ef-row__title" to={event.action_path} onClick={() => onOpen?.(event)}>{title}</Link>
            : <span className="ef-row__title">{title}</span>}
          {unread && <span className="ef-row__dot" aria-label={m.ui_notification_unread()} />}
        </div>
        {message && <p className="ef-row__message">{message}</p>}
        <div className="ef-row__meta">
          <span className={`ef-row__group ws-tone-${category.tone}`}>
            <DuotoneIcon name={category.icon} />
            {category.label}
          </span>
          {meta}
          <EventTime time={time} />
        </div>
      </div>
      <div className="ef-row__actions">
        {actions}
        {event.action_path && (
          // A wider click target for the title link; keyboard users reach the title.
          <Link aria-hidden tabIndex={-1} className="ef-row__open" to={event.action_path} onClick={() => onOpen?.(event)}>
            <DuotoneIcon name="caretRight" />
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
        <Button loading={query.isFetchingNextPage} onClick={() => query.fetchNextPage()} className="ef-more">
          {m.employer_workspace_load_more()}
        </Button>
      )}
    </div>
  )
}
