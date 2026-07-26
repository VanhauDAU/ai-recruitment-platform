import { FilterOutlined, SearchOutlined, SortAscendingOutlined } from '@ant-design/icons'
import { Badge, Button, Drawer, Grid, Input, Popover, Select, Tag, Tooltip } from 'antd'
import { useState } from 'react'
import {
  ADVANCED_KEYS,
  BOOLEAN_OPTIONS,
  emptyValueOf,
  isFilled,
  labelOf,
  ORDERING_OPTIONS,
  rangeText,
  STATUS_OPTIONS,
} from '../model/account-filter-options'
import AccountAdvancedFilters from './AccountAdvancedFilters'

export default function AccountFilters({
  filters,
  departments,
  roles,
  total,
  loading,
  onChange,
  onClear,
}) {
  const [advancedOpen, setAdvancedOpen] = useState(false)
  // Popover 640px không lọt viewport điện thoại nên dưới `md` dùng drawer đáy.
  const isCompact = !Grid.useBreakpoint().md
  const patch = (name, value) => onChange({ ...filters, [name]: value })

  const advancedCount = ADVANCED_KEYS.filter((key) => isFilled(filters[key])).length
  const chips = [
    ['q', 'Từ khóa', filters.q.trim()],
    ['status', 'Trạng thái', labelOf(STATUS_OPTIONS, filters.status)],
    ['email_verified', 'Xác minh email', labelOf(BOOLEAN_OPTIONS, filters.email_verified)],
    ['mfa', 'Bật MFA', labelOf(BOOLEAN_OPTIONS, filters.mfa)],
    ['has_active_session', 'Phiên hoạt động', labelOf(BOOLEAN_OPTIONS, filters.has_active_session)],
    ['department', 'Phòng ban', departments.find((item) => item.public_id === filters.department)?.name],
    ['admin_role', 'Chức danh', roles.find((item) => item.public_id === filters.admin_role)?.name],
    ['company', 'Mã công ty', filters.company.trim()],
    ['created_range', 'Ngày tạo', filters.created_range?.length === 2 && rangeText(filters.created_range)],
    ['last_login_range', 'Đăng nhập', filters.last_login_range?.length === 2 && rangeText(filters.last_login_range)],
  ].filter(([, , value]) => Boolean(value))

  const advanced = (
    <AccountAdvancedFilters
      filters={filters}
      departments={departments}
      roles={roles}
      onChange={onChange}
      onDone={() => setAdvancedOpen(false)}
    />
  )

  return (
    <div className="account-filters">
      <div className="account-filters__controls">
        <Input
          allowClear
          className="account-filters__search"
          size="large"
          prefix={<SearchOutlined className="text-slate-400" />}
          placeholder="Tìm theo tên, email hoặc mã tài khoản"
          value={filters.q}
          onChange={(event) => patch('q', event.target.value)}
        />
        <Select
          className="account-filters__status"
          size="large"
          value={filters.status}
          onChange={(value) => patch('status', value)}
          options={STATUS_OPTIONS}
        />
        <Select
          className="account-filters__ordering"
          size="large"
          value={filters.ordering}
          onChange={(value) => patch('ordering', value)}
          options={ORDERING_OPTIONS}
          prefix={<SortAscendingOutlined className="text-slate-400" />}
        />
        {/* Badge phải bọc ngoài Popover: antd v6 không chuyển tiếp handler của
            trigger qua Badge nên popover sẽ không mở nếu lồng ngược lại. */}
        <Badge count={advancedCount} size="small" offset={[-8, 8]}>
          {isCompact ? (
            <Button
              size="large"
              icon={<FilterOutlined />}
              className="account-filters__advanced"
              onClick={() => setAdvancedOpen(true)}
            >
              Bộ lọc
            </Button>
          ) : (
            <Popover
              trigger="click"
              placement="bottomRight"
              open={advancedOpen}
              onOpenChange={setAdvancedOpen}
              content={advanced}
              title="Bộ lọc nâng cao"
            >
              <Button size="large" icon={<FilterOutlined />} className="account-filters__advanced">
                Bộ lọc
              </Button>
            </Popover>
          )}
        </Badge>
      </div>

      {isCompact && (
        <Drawer
          title="Bộ lọc nâng cao"
          placement="bottom"
          size="large"
          open={advancedOpen}
          onClose={() => setAdvancedOpen(false)}
          classNames={{ wrapper: 'account-filter-drawer' }}
        >
          {advanced}
        </Drawer>
      )}

      <div className="account-filters__meta">
        <span className="account-filters__count">
          {loading ? 'Đang tải danh sách…' : (
            <>
              <strong>{Number(total || 0).toLocaleString('vi-VN')}</strong>
              {' tài khoản'}
              {chips.length > 0 ? ' khớp bộ lọc' : ' trong phạm vi được xem'}
            </>
          )}
        </span>
        {chips.length > 0 && (
          <div className="account-filters__chips">
            {chips.map(([key, label, value]) => (
              <Tag
                key={key}
                closable
                className="account-filters__chip"
                onClose={() => patch(key, emptyValueOf(key))}
              >
                <span>{label}:</span>
                {' '}
                {value}
              </Tag>
            ))}
            <Tooltip title="Xóa toàn bộ điều kiện lọc">
              <Button type="link" size="small" onClick={onClear}>
                Xóa tất cả
              </Button>
            </Tooltip>
          </div>
        )}
      </div>
    </div>
  )
}
