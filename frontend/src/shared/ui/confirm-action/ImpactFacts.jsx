import { Alert, Button, Skeleton } from 'antd'
import { m } from '@/shared/config/i18n'

/**
 * Compact impact summary for ActionDialog. `facts` are one-line label/value
 * pairs (tone: warning | danger | success), `blockers` stop the action,
 * `notes` are short consequences, `details` goes behind "Xem chi tiết".
 */
export default function ImpactFacts({
  blockers = [],
  changed = false,
  details,
  error,
  facts = [],
  heading = m.common_impact_heading(),
  loading = false,
  notes = [],
  onRetry,
}) {
  if (loading && !facts.length) {
    return (
      <section className="impact-facts" aria-busy="true" aria-label={heading}>
        <Skeleton active title={false} paragraph={{ rows: 2 }} />
      </section>
    )
  }
  if (error && !facts.length) {
    return (
      <Alert
        showIcon
        type="error"
        title={error}
        action={onRetry && <Button size="small" onClick={onRetry}>{m.common_retry()}</Button>}
      />
    )
  }
  return (
    <section className="impact-facts" aria-label={heading} aria-live="polite">
      <h3 className="impact-facts__heading">{heading}</h3>
      {changed && (
        <Alert showIcon type="warning" title={m.common_impact_changed()} />
      )}
      {facts.length > 0 && (
        <dl className="impact-facts__list">
          {facts.map((fact) => (
            <div className={`impact-facts__item impact-facts__item--${fact.tone || 'default'}`} key={fact.label}>
              <dt>{fact.label}</dt>
              <dd>{fact.value}</dd>
            </div>
          ))}
        </dl>
      )}
      {notes.length > 0 && (
        <ul className="impact-facts__notes">
          {notes.map((note) => <li key={note}>{note}</li>)}
        </ul>
      )}
      {blockers.map((blocker) => (
        <Alert key={blocker} showIcon type="error" title={blocker} />
      ))}
      {details && (
        <details>
          <summary>{m.common_show_details()}</summary>
          {details}
        </details>
      )}
    </section>
  )
}
