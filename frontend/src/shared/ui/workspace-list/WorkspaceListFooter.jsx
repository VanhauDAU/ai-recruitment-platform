import { Pagination } from 'antd'

// Range summary and pages, pinned to the bottom of the workspace. Pass
// `onPageSizeChange` (with `pageSizeOptions`) to let the viewer pick a page
// size. Styles: ./workspace-table.css.
export default function WorkspaceListFooter({ summary, page, pageSize, total, onChange, pageSizeOptions, onPageSizeChange }) {
  return (
    <div className="wt-footer">
      <span>{summary}</span>
      <Pagination
        current={page}
        pageSize={pageSize}
        total={total}
        showSizeChanger={Boolean(onPageSizeChange)}
        pageSizeOptions={pageSizeOptions}
        onChange={(nextPage, nextSize) => {
          if (onPageSizeChange && nextSize !== pageSize) onPageSizeChange(nextSize)
          else onChange(nextPage)
        }}
      />
    </div>
  )
}
