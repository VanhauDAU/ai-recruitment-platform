import { Pagination } from 'antd'

// Range summary and pages, pinned to the bottom of the workspace. Styles:
// ./workspace-table.css.
export default function WorkspaceListFooter({ summary, page, pageSize, total, onChange }) {
  return (
    <div className="wt-footer">
      <span>{summary}</span>
      <Pagination
        current={page}
        pageSize={pageSize}
        total={total}
        showSizeChanger={false}
        onChange={onChange}
      />
    </div>
  )
}
