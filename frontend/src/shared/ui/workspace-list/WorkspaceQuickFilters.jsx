import { getIntlLocale } from '@/shared/config/i18n'

// Toggle chips for rows that need attention, each with how many rows it would
// keep, plus the clear-filters link. Styles: ./workspace-list.css.
export default function WorkspaceQuickFilters({ label, ariaLabel, items, value, onChange, clearLabel, onClear }) {
  return (
    <div className="wt-toolbar__quick">
      <span className="wt-toolbar__label">{label}</span>
      <div role="group" aria-label={ariaLabel} className="ws-quick__chips">
        {items.map((item) => {
          const active = value === item.value
          return (
            <button
              key={item.value}
              type="button"
              aria-pressed={active}
              title={item.hint}
              disabled={!active && item.count === 0}
              className={`ws-chip ws-tone-${item.tone}`}
              onClick={() => onChange(active ? '' : item.value)}
            >
              <span aria-hidden className="ws-dot" />
              {item.label}
              {item.count !== undefined && <span className="ws-chip__count">{item.count.toLocaleString(getIntlLocale())}</span>}
            </button>
          )
        })}
      </div>
      {onClear && (
        <button type="button" className="ws-link-button" onClick={onClear}>{clearLabel}</button>
      )}
    </div>
  )
}
