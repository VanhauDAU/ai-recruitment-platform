import { Alert, Button, Empty, Skeleton } from 'antd'
import { getApiErrorMessage } from '@/shared/api/error-mapper'
import { getIntlLocale, m } from '@/shared/config/i18n'
import WorkspaceListFooter from '@/shared/ui/workspace-list/WorkspaceListFooter'
import WorkspaceSortHeader from '@/shared/ui/workspace-list/WorkspaceSortHeader'
import WorkspaceStatusTiles from '@/shared/ui/workspace-list/WorkspaceStatusTiles'
import { DEFAULT_FILTERS, PAGE_SIZES } from '../model/account-query'
import AccountListRow from './AccountListRow'
import AccountListToolbar from './AccountListToolbar'
import '@/shared/ui/workspace-list/workspace-list.css'
import '@/shared/ui/workspace-list/workspace-table.css'

const formatCount = (value) => (value ?? 0).toLocaleString(getIntlLocale())

// [ordering field, header, ascending first] per column; null field = not sortable.
const USER_COLUMNS = [
  ['full_name', m.admin_account_list_col_account()],
  ['role', m.admin_account_list_col_role()],
  ['status', m.admin_account_list_col_status()],
  ['last_session_seen_at', m.admin_account_list_col_activity()],
  ['date_joined', m.admin_account_list_col_joined()],
  [null, m.admin_account_list_col_actions()],
]
const RECRUITER_COLUMNS = [
  ['full_name', m.admin_recruiter_list_col_recruiter()],
  ['next_action', m.admin_recruiter_list_col_next(), true],
  ['recruiter_profile__verification_case__status', m.admin_recruiter_list_col_verification()],
  ['recruiter_profile__company__company_name', m.admin_recruiter_list_col_company()],
  ['status', m.admin_recruiter_list_col_account()],
  [null, m.admin_account_list_col_actions()],
]

/** Account or recruiter list on the shared workspace table. */
export default function AccountList({
  recruiterOnly,
  tiles,
  toolbar,
  query,
  page,
  pageSize,
  onPageChange,
  onPageSizeChange,
  originState,
  actions,
}) {
  const data = query.data || { count: 0, results: [] }
  const results = data.results || []
  const ordering = toolbar.filters.ordering
  const onSort = (value) => toolbar.onChange({ ...toolbar.filters, ordering: value })
  const columns = recruiterOnly ? RECRUITER_COLUMNS : USER_COLUMNS
  const firstRow = (page - 1) * pageSize + 1
  const lastRow = Math.min(page * pageSize, data.count || 0)

  return (
    <div className="wt-page">
      <div className={recruiterOnly ? undefined : 'aml-tiles--four'}>
        <WorkspaceStatusTiles {...tiles} />
      </div>

      <div className={`wt-table wt-table--compact ${recruiterOnly ? 'aml-table--recruiters' : 'aml-table--users'}`}>
        <AccountListToolbar recruiterOnly={recruiterOnly} {...toolbar} />

        <div className="wt-head">
          {columns.map(([field, label, ascendingFirst]) => (
            <span key={label}>
              {field
                ? <WorkspaceSortHeader field={field} ascendingFirst={ascendingFirst} ordering={ordering} defaultOrdering={DEFAULT_FILTERS.ordering} onSort={onSort}>{label}</WorkspaceSortHeader>
                : label}
            </span>
          ))}
        </div>

        {query.isError && (
          <div className="p-3">
            <Alert
              action={<Button onClick={() => query.refetch()}>Thử lại</Button>}
              description={getApiErrorMessage(query.error)}
              showIcon
              title={recruiterOnly ? 'Không thể tải danh sách nhà tuyển dụng' : 'Không thể tải danh sách người dùng'}
              type="error"
            />
          </div>
        )}

        {query.isLoading ? (
          <div aria-label={m.admin_account_list_loading_aria()}>
            {[1, 2, 3, 4].map((item) => (
              <div key={item} className="wt-row">
                <Skeleton active avatar title={{ width: '40%' }} paragraph={{ rows: 1 }} className="aml-skeleton" />
              </div>
            ))}
          </div>
        ) : results.length === 0 && !query.isError ? (
          <div className="wt-empty">
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={m.admin_account_list_empty()} />
          </div>
        ) : (
          <div aria-busy={query.isFetching} className={`transition-opacity ${query.isPlaceholderData ? 'opacity-60' : ''}`}>
            {results.map((row) => (
              <AccountListRow key={row.public_id} row={row} recruiter={recruiterOnly} originState={originState} actions={actions} />
            ))}
          </div>
        )}
      </div>

      {data.count > 0 && (
        <WorkspaceListFooter
          summary={m.admin_account_list_range({ first: firstRow, last: lastRow, total: formatCount(data.count) })}
          page={page}
          pageSize={pageSize}
          total={data.count}
          onChange={onPageChange}
          pageSizeOptions={onPageSizeChange ? PAGE_SIZES : undefined}
          onPageSizeChange={onPageSizeChange}
        />
      )}
    </div>
  )
}
