import {
  FilterOutlined,
  PlusOutlined,
  SearchOutlined,
} from '@ant-design/icons'
import { Button, Input, Select, Space } from 'antd'
import {
  KIND_OPTIONS,
  STATUS_OPTIONS,
  SURFACE_OPTIONS,
} from '../model/announcement-options'

export default function AnnouncementFilters({
  canCreate,
  filters,
  actions,
  onChange,
  onCreate,
  onReset,
  searchInput,
  onSearchChange,
  total,
}) {
  return (
    <section className="announcement-filters" aria-label="Bộ lọc thông báo">
      <div className="announcement-filters__heading">
        <div>
          <span className="announcement-filters__count">
            {total.toLocaleString('vi-VN')} thông báo
          </span>
          <p>Lọc và sắp xếp được xử lý trên toàn bộ dữ liệu phía server.</p>
        </div>
        <Space wrap>
          {actions}
          {canCreate && (
            <Button type="primary" icon={<PlusOutlined />} onClick={onCreate}>
              Tạo thông báo
            </Button>
          )}
        </Space>
      </div>
      <div className="announcement-filters__controls">
        <Input
          allowClear
          prefix={<SearchOutlined />}
          value={searchInput}
          onChange={onSearchChange}
          placeholder="Tìm theo tên hoặc mã thông báo"
          aria-label="Tìm thông báo"
        />
        <Select
          allowClear
          value={filters.lifecycle_state || undefined}
          onChange={(value) => onChange({ lifecycle_state: value || '' })}
          options={STATUS_OPTIONS}
          placeholder="Lifecycle"
          aria-label="Lọc lifecycle"
        />
        <Select
          allowClear
          value={filters.kind || undefined}
          onChange={(value) => onChange({ kind: value || '' })}
          options={KIND_OPTIONS}
          placeholder="Loại thông tin"
          aria-label="Lọc loại thông tin"
        />
        <Select
          allowClear
          value={filters.surface || undefined}
          onChange={(value) => onChange({ surface: value || '' })}
          options={SURFACE_OPTIONS}
          placeholder="Surface"
          aria-label="Lọc surface"
        />
        <Button icon={<FilterOutlined />} onClick={onReset}>Xóa bộ lọc</Button>
      </div>
    </section>
  )
}
