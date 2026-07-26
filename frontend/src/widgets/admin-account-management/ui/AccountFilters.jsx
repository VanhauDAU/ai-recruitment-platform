import {
  CloseCircleOutlined,
  FilterOutlined,
  SearchOutlined,
} from '@ant-design/icons'
import { Badge, Button, DatePicker, Input, Popover, Select, Space, Tooltip } from 'antd'

const { RangePicker } = DatePicker

const booleanOptions = [
  { value: '', label: 'Tất cả' },
  { value: 'true', label: 'Có' },
  { value: 'false', label: 'Không' },
]

export default function AccountFilters({
  filters,
  departments,
  roles,
  onChange,
  onClear,
}) {
  const advancedCount = [
    filters.status,
    filters.email_verified,
    filters.mfa,
    filters.has_active_session,
    filters.department,
    filters.admin_role,
    filters.company,
    filters.created_range?.length,
    filters.last_login_range?.length,
  ].filter(Boolean).length

  const patch = (name, value) => onChange({ ...filters, [name]: value })
  const content = (
    <div className="account-filter-popover">
      <div className="account-filter-grid">
        <label>
          <span>Trạng thái</span>
          <Select
            value={filters.status}
            onChange={(value) => patch('status', value)}
            options={[
              { value: '', label: 'Tất cả trạng thái' },
              { value: 'active', label: 'Đang hoạt động' },
              { value: 'pending', label: 'Chờ kích hoạt' },
              { value: 'inactive', label: 'Tạm khóa' },
              { value: 'banned', label: 'Đã cấm' },
            ]}
          />
        </label>
        <label>
          <span>Xác minh email</span>
          <Select
            value={filters.email_verified}
            onChange={(value) => patch('email_verified', value)}
            options={booleanOptions}
          />
        </label>
        <label>
          <span>Đã bật MFA</span>
          <Select
            value={filters.mfa}
            onChange={(value) => patch('mfa', value)}
            options={booleanOptions}
          />
        </label>
        <label>
          <span>Có phiên hoạt động</span>
          <Select
            value={filters.has_active_session}
            onChange={(value) => patch('has_active_session', value)}
            options={booleanOptions}
          />
        </label>
        <label>
          <span>Phòng ban Admin</span>
          <Select
            allowClear
            showSearch
            optionFilterProp="label"
            placeholder="Chọn phòng ban"
            value={filters.department || undefined}
            onChange={(value) => patch('department', value || '')}
            options={departments.map((item) => ({
              value: item.public_id,
              label: item.name,
            }))}
          />
        </label>
        <label>
          <span>Chức danh Admin</span>
          <Select
            allowClear
            showSearch
            optionFilterProp="label"
            placeholder="Chọn chức danh"
            value={filters.admin_role || undefined}
            onChange={(value) => patch('admin_role', value || '')}
            options={roles.map((item) => ({
              value: item.public_id,
              label: `${item.department.name} · ${item.name}`,
            }))}
          />
        </label>
        <label>
          <span>Mã công ty</span>
          <Input
            allowClear
            placeholder="Ví dụ: cmp_..."
            value={filters.company}
            onChange={(event) => patch('company', event.target.value)}
          />
        </label>
        <label>
          <span>Sắp xếp</span>
          <Select
            value={filters.ordering}
            onChange={(value) => patch('ordering', value)}
            options={[
              { value: '-date_joined', label: 'Mới tạo gần đây' },
              { value: 'date_joined', label: 'Tạo lâu nhất' },
              { value: '-last_login', label: 'Đăng nhập gần nhất' },
              { value: 'full_name', label: 'Tên A–Z' },
              { value: 'email', label: 'Email A–Z' },
            ]}
          />
        </label>
        <label className="account-filter-grid__wide">
          <span>Ngày tạo tài khoản</span>
          <RangePicker
            value={filters.created_range || null}
            onChange={(value) => patch('created_range', value || [])}
            format="DD/MM/YYYY"
          />
        </label>
        <label className="account-filter-grid__wide">
          <span>Lần đăng nhập gần nhất</span>
          <RangePicker
            value={filters.last_login_range || null}
            onChange={(value) => patch('last_login_range', value || [])}
            format="DD/MM/YYYY"
          />
        </label>
      </div>
      <div className="account-filter-popover__footer">
        <Button icon={<CloseCircleOutlined />} onClick={onClear}>Xóa bộ lọc</Button>
      </div>
    </div>
  )

  return (
    <div className="account-filter-bar">
      <Input
        allowClear
        className="account-filter-bar__search"
        prefix={<SearchOutlined className="text-slate-400" />}
        placeholder="Tìm theo tên, email hoặc mã tài khoản"
        value={filters.q}
        onChange={(event) => patch('q', event.target.value)}
      />
      <Space>
        {advancedCount > 0 && (
          <Tooltip title="Xóa toàn bộ điều kiện lọc">
            <Button
              aria-label="Xóa bộ lọc"
              icon={<CloseCircleOutlined />}
              onClick={onClear}
            />
          </Tooltip>
        )}
        <Popover
          trigger="click"
          placement="bottomRight"
          content={content}
          title="Bộ lọc nâng cao"
        >
          <Badge count={advancedCount} size="small" offset={[-2, 3]}>
            <Button icon={<FilterOutlined />}>Bộ lọc</Button>
          </Badge>
        </Popover>
      </Space>
    </div>
  )
}
