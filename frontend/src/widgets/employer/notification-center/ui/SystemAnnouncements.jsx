import { Link } from 'react-router'
import { normalizeAnnouncementUrl } from '@/entities/content/announcement'
import { m } from '@/shared/config/i18n'
import { formatDateTime } from '@/shared/lib/date-time'
import DuotoneIcon from '@/shared/ui/icons/DuotoneIcon'

// Admin-chosen icon of an announcement, drawn with the duotone set.
const ICONS = {
  'alert-triangle': 'warningCircle',
  bell: 'bellRinging',
  'check-circle': 'sealCheck',
  info: 'info',
  lock: 'lock',
  megaphone: 'megaphone',
  shield: 'shieldCheck',
  sparkles: 'sparkle',
  wrench: 'wrench',
}
// Same rule as events: only what needs attention carries color.
const KIND_SEVERITY = { critical: 'danger', security: 'danger', compliance: 'warning', warning: 'warning', maintenance: 'warning' }
const KIND_LABELS = {
  critical: m.employer_workspace_announcement_kind_critical(),
  security: m.employer_workspace_announcement_kind_security(),
  compliance: m.employer_workspace_announcement_kind_compliance(),
  warning: m.employer_workspace_announcement_kind_warning(),
  maintenance: m.employer_workspace_announcement_kind_maintenance(),
  info: m.employer_workspace_announcement_kind_info(),
  success: m.employer_workspace_announcement_kind_success(),
  event: m.employer_workspace_announcement_kind_event(),
  feature: m.employer_workspace_announcement_kind_feature(),
}

function AnnouncementCta({ cta }) {
  const target = cta?.label && normalizeAnnouncementUrl(cta.url)
  if (!target) return null
  return target.external
    ? <a className="ef-cta" href={target.url} target="_blank" rel="noopener noreferrer">{cta.label}</a>
    : <Link className="ef-cta" to={target.url}>{cta.label}</Link>
}

/** One admin announcement: what kind it is, the message and its call to action. */
function AnnouncementRow({ item }) {
  return (
    <article className="ef-row ef-row--announcement">
      <span aria-hidden className="ef-row__icon" data-severity={KIND_SEVERITY[item.kind] || 'info'}>
        <DuotoneIcon name={ICONS[item.icon] || 'megaphone'} />
      </span>
      <div className="ef-row__body">
        <p className="ef-row__eyebrow">{item.badge || KIND_LABELS[item.kind] || KIND_LABELS.info}</p>
        <p className="ef-row__title ef-row__title--text">{item.message}</p>
        <p className="ef-row__meta">
          {item.is_live
            ? <span className="ef-live">{m.employer_workspace_announcement_live()}</span>
            : <span>{m.employer_workspace_announcement_shown({ date: formatDateTime(item.shown_at) })}</span>}
          {item.is_live && item.ends_at && <span>{m.employer_workspace_announcement_until({ date: formatDateTime(item.ends_at) })}</span>}
        </p>
      </div>
      <div className="ef-row__side"><AnnouncementCta cta={item.cta} /></div>
    </article>
  )
}

/** Live announcements pinned above the notifications of the "All" view. */
export function PinnedAnnouncements({ items }) {
  if (!items.length) return null
  return (
    <section className="ef-pinned" aria-label={m.employer_workspace_announcements_title()}>
      <h3 className="ef-day"><span>{m.employer_workspace_announcements_title()}</span></h3>
      <div className="ef-rows">{items.map((item) => <AnnouncementRow key={item.public_id} item={item} />)}</div>
    </section>
  )
}

/** The "System" group: every announcement of the last 90 days. */
export function AnnouncementHistory({ items }) {
  return (
    <div className="ef-rows ef-rows--history">
      <p className="ef-note">{m.employer_workspace_announcements_hint()}</p>
      {items.map((item) => <AnnouncementRow key={item.public_id} item={item} />)}
    </div>
  )
}
