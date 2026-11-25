import { FilterOutlined, SearchOutlined } from '@ant-design/icons'
import { Badge, Drawer, Grid, Input, Popover, Select, Tag } from 'antd'
import { useState } from 'react'
import { m } from '@/shared/config/i18n'
import WorkspaceQuickFilters from '@/shared/ui/workspace-list/WorkspaceQuickFilters'
import {
  ADVANCED_KEYS,
  BOOLEAN_OPTIONS,
  emptyValueOf,
  isFilled,
  labelOf,
  RECRUITER_ORDERING_OPTIONS,
  rangeText,
  RECRUITER_ADVANCED_ONLY,
  STATUS_OPTIONS,
  USER_ORDERING_OPTIONS,
  VERIFICATION_OPTIONS,
} from '../model/account-filter-options'
import AccountAdvancedFilters from './AccountAdvancedFilters'

/**
 * Toolbar of the account table: quick chips, status, order, advanced filters
 * and search, plus one row of chips for the advanced conditions in use.
 */
export default function AccountListToolbar({
  filters,
  recruiterOnly = false,
  quickItems,
  quickValue,
  onQuick,
  onChange,
  onClear,
}) {
  const [advancedOpen, setAdvancedOpen] = useState(false)
  // A 640px popover does not fit a phone, so below `md` it is a bottom drawer.
  const isCompact = !Grid.useBreakpoint().md
  const patch = (name, value) => onChange({ ...filters, [name]: value })
  const advancedKeys = recruiterOnly ? ADVANCED_KEYS : ADVANCED_KEYS.filter((key) => !RECRUITER_ADVANCED_ONLY.includes(key))
  const advancedCount = advancedKeys.filter((key) => isFilled(filters[key])).length
  const orderingOptions = recruiterOnly ? RECRUITER_ORDERING_OPTIONS : USER_ORDERING_OPTIONS
  const hasFilters = Boolean(filters.q.trim() || filters.status || filters.next_action || advancedCount)
  const chips = [
    ['email_verified', 'Xác minh email', labelOf(BOOLEAN_OPTIONS, filters.email_verified)],
    ['has_active_session', 'Phiên hoạt động', labelOf(BOOLEAN_OPTIONS, filters.has_active_session)],
    ...(recruiterOnly ? [
      ['company', 'Mã công ty', filters.company.trim()],
      ['company_state', 'Liên kết công ty', { linked: 'Đã liên kết', missing: 'Chưa liên kết' }[filters.company_state]],
      ['verification_status', 'Xác thực NTD', labelOf(VERIFICATION_OPTIONS, filters.verification_status)],
    ] : []),
    ['created_range', 'Ngày tạo', filters.created_range?.length === 2 && rangeText(filters.created_range)],
    ['last_login_range', 'Đăng nhập', filters.last_login_range?.length === 2 && rangeText(filters.last_login_range)],
  ].filter(([, , value]) => Boolean(value))

  const advanced = (
    <AccountAdvancedFilters
      filters={filters}
      recruiterOnly={recruiterOnly}
      onChange={onChange}
      onDone={() => setAdvancedOpen(false)}
    />
  )
  const advancedButton = (
    <button type="button" className="wt-btn aml-advanced" onClick={isCompact ? () => setAdvancedOpen(true) : undefined}>
      <FilterOutlined aria-hidden /><span>{m.admin_account_list_advanced()}</span>
    </button>
  )

  return (
    <>
      <div className="wt-toolbar">
        <WorkspaceQuickFilters
          label={m.admin_account_list_quick_label()}
          ariaLabel={m.admin_account_list_quick_aria()}
          items={quickItems}
          value={quickValue}
          onChange={onQuick}
          clearLabel={m.admin_account_list_clear_filters()}
          onClear={hasFilters ? onClear : undefined}
        />
        <div className="wt-filters">
          <Select
            aria-label={m.admin_account_list_status_aria()}
            value={filters.status}
            onChange={(value) => patch('status', value)}
            options={STATUS_OPTIONS}
          />
          <Select
            aria-label={m.admin_account_list_sort_aria()}
            value={orderingOptions.some((option) => option.value === filters.ordering) ? filters.ordering : undefined}
            placeholder={m.admin_account_list_sort_by_column()}
            onChange={(value) => patch('ordering', value)}
            options={orderingOptions}
          />
          <Input
            allowClear
            type="search"
            className="wt-filters__search"
            aria-label={m.admin_account_list_search_aria()}
            prefix={<SearchOutlined className="text-slate-400" aria-hidden />}
            placeholder={recruiterOnly
              ? 'Tìm tên, email, công ty, MST hoặc số điện thoại…'
              : 'Tìm theo tên, email hoặc mã tài khoản'}
            value={filters.q}
            onChange={(event) => patch('q', event.target.value)}
          />
          <div className="wt-filters__extra">
            {/* Badge wraps the popover: antd v6 does not pass the trigger's
                handlers through a Badge nested inside it. */}
            <Badge count={advancedCount} size="small">
              {isCompact ? advancedButton : (
                <Popover
                  trigger="click"
                  placement="bottomRight"
                  open={advancedOpen}
                  onOpenChange={setAdvancedOpen}
                  content={advanced}
                  title={m.admin_account_list_advanced_title()}
                >
                  {advancedButton}
                </Popover>
              )}
            </Badge>
          </div>
        </div>
      </div>

      {isCompact && (
        <Drawer
          title={m.admin_account_list_advanced_title()}
          placement="bottom"
          size="large"
          open={advancedOpen}
          onClose={() => setAdvancedOpen(false)}
          classNames={{ wrapper: 'account-filter-drawer' }}
        >
          {advanced}
        </Drawer>
      )}

      {chips.length > 0 && (
        <div className="aml-applied">
          <span className="wt-toolbar__label">{m.admin_account_list_applied()}</span>
          {chips.map(([key, label, value]) => (
            <Tag key={key} closable className="aml-applied__chip" onClose={() => patch(key, emptyValueOf(key))}>
              <span>{label}:</span> {value}
            </Tag>
          ))}
        </div>
      )}
    </>
  )
}
