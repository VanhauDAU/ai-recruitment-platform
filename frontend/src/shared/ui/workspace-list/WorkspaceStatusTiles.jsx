// Status tiles above a workspace table: each shows how many rows a status has
// and filters the table to it. Styles: ./workspace-table.css.
export default function WorkspaceStatusTiles({ ariaLabel, items, value, onChange }) {
  return (
    <div role="group" aria-label={ariaLabel} className="wt-tiles">
      {items.map((item) => (
        <button
          key={item.key}
          type="button"
          aria-pressed={value === item.value}
          className="wt-tile"
          onClick={() => onChange(item.value)}
        >
          <span aria-hidden className="wt-tile__icon">{item.icon}</span>
          <span className="wt-tile__body">
            <span className="wt-tile__label">{item.label}</span>
            {item.count === undefined
              ? <span aria-hidden className="wt-tile__value wt-tile__value--loading" />
              : <span className="wt-tile__value">{item.count}</span>}
          </span>
        </button>
      ))}
    </div>
  )
}
