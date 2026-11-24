import { ArrowDownOutlined, ArrowUpOutlined } from '@ant-design/icons'

// Sortable column header of a workspace table. A click sorts descending, a
// second ascending, a third goes back to the list's default order;
// `ascendingFirst` swaps the first two (e.g. "most urgent first").
// Styles: ./workspace-list.css (.ws-sort).
export default function WorkspaceSortHeader({ field, ordering, defaultOrdering, onSort, ascendingFirst = false, children }) {
  const active = ordering === field || ordering === `-${field}`
  const Arrow = ordering === field ? ArrowUpOutlined : ArrowDownOutlined
  const [first, second] = ascendingFirst ? [field, `-${field}`] : [`-${field}`, field]
  const next = ordering === first ? second : ordering === second ? defaultOrdering : first
  return (
    <button type="button" className="ws-sort" aria-pressed={active} onClick={() => onSort(next)}>
      {children}
      <Arrow aria-hidden className="ws-sort__icon" />
    </button>
  )
}
