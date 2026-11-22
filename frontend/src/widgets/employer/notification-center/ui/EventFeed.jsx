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

const CATEGORIES = Object.fromEntries(EMPLOYER_EVENT_CATEGORIES.map((item) => [item.value, item]))

/**
 * Two columns from 1024px: a side rail (summary + group navigation) and the
 * feed. Below that the rail stacks on top and the groups scroll sideways.
 */
export function FeedLayout({ titleId, title, side, children }) {
  return (
    <section className="ef-shell" aria-labelledby={titleId}>
      <h1 id={titleId} className="sr-only">{title}</h1>
      <aside className="ef-side">{side}</aside>
      <div className="ef-main">{children}</div>
    </section>
  )
}

/** Big number on a quiet card: "3 chưa đọc", "32 hoạt động". */
export function FeedSummary({ eyebrow, value, unit, hint, children }) {
  return (
    <div className="ef-summary">
      <p className="ef-summary__eyebrow">{eyebrow}</p>
      <p className="ef-summary__figure">
        <span className="ef-summary__value">{value ?? '–'}</span>
        <span className="ef-summary__unit">{unit}</span>
      </p>
      {hint && <p className="ef-summary__hint">{hint}</p>}
      {children}
    </div>
  )
}

/** Group navigation; the selected group filters the feed. */
export function CategoryNav({ value, counts, onChange }) {
  return (
    <div role="group" aria-label={m.employer_workspace_event_category_aria()} className="ef-nav">
      {EMPLOYER_EVENT_CATEGORIES.map((item) => {
        const count = counts?.[item.countKey]
        return (
          <button
            key={item.countKey}
            type="button"
            aria-pressed={value === item.value}
            className="ef-nav__item"
            onClick={() => onChange(item.value)}
          >
            <DuotoneIcon name={item.icon} className="ef-nav__icon" />
            <span className="ef-nav__label">{item.label}</span>
            <span className={`ef-nav__count${count ? '' : ' is-zero'}`}>{count ?? ''}</span>
          </button>
        )
      })}
    </div>
  )
}

/** Header of the feed column: the open group and its view switch. */
export function FeedToolbar({ category, children }) {
  return (
    <div className="ef-toolbar">
      <h2 className="ef-toolbar__title">{(CATEGORIES[category] || CATEGORIES['']).label}</h2>
      <div className="ef-toolbar__tools">{children}</div>
    </div>
  )
}

/** Segmented switch; `options` are `{ value, label }`. */
export function Segmented({ label, value, options, onChange }) {
  return (
    <div role="group" aria-label={label} className="ef-segmented">
      {options.map((option) => (
        <button key={option.value || 'all'} type="button" aria-pressed={value === option.value} onClick={() => onChange(option.value)}>
          {option.label}
        </button>
      ))}
    </div>
  )
}

/** Rows under day labels ("Hôm nay", "Hôm qua", weekday). */
export function EventDayGroups({ items, timeOf, renderRow, variant = 'list' }) {
  const groups = []
  items.forEach((item) => {
    const day = localDayKey(timeOf(item))
    if (groups.at(-1)?.day !== day) groups.push({ day, items: [] })
    groups.at(-1).items.push(item)
  })
  return groups.map((group) => (
    <section key={group.day} className="ef-group">
      <h3 className="ef-day"><span>{formatRelativeDay(timeOf(group.items[0]))}</span></h3>
      <div className={`ef-rows ef-rows--${variant}`}>
        {group.items.map((item) => <Fragment key={item.public_id}>{renderRow(item)}</Fragment>)}
      </div>
    </section>
  ))
}

function EventTime({ time }) {
  const today = localDayKey(time) === localDayKey(new Date())
  return (
    <Tooltip title={formatDateTime(time)}>
      <time dateTime={time} className="ef-row__time">{today ? formatTimeAgo(time) : formatClockTime(time)}</time>
    </Tooltip>
  )
}

/**
 * One event in neutral tones: what happened, the title linking to the page
 * that handles it, an optional message, then group and meta. Only warnings
 * and failures carry color, as a small dot on the icon.
 */
export function EventRow({ event, title, time, message, meta, unread = false, onOpen, actions }) {
  const category = CATEGORIES[event.category] || CATEGORIES.company
  const severity = employerNotificationTone(event.event_type)
  return (
    <article className={`ef-row${unread ? ' is-unread' : ''}`}>
      <span aria-hidden className="ef-row__icon" data-severity={severity}>
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
        <p className="ef-row__meta">
          <span>{category.label}</span>
          {meta}
        </p>
      </div>
      <div className="ef-row__side">
        <EventTime time={time} />
        <div className="ef-row__actions">{actions}</div>
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
