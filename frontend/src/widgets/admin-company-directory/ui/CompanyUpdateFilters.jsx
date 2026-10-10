import { SearchOutlined, SortAscendingOutlined } from '@ant-design/icons'
import { Button, Input, Select, Tag, Tooltip } from 'antd'

const ORDERING_OPTIONS = [
  { value: '-updated_at', label: 'Tiếp nhận gần nhất' },
  { value: 'updated_at', label: 'Tiếp nhận lâu nhất' },
  { value: 'company__company_name', label: 'Tên công ty A–Z' },
  { value: '-change_count', label: 'Nhiều thay đổi nhất' },
  { value: '-is_sensitive', label: 'Ưu tiên thay đổi pháp lý' },
]

const STATUS_OPTIONS = [
  { value: 'submitted', label: 'Chờ tiếp nhận' },
  { value: 'in_review', label: 'Đang thẩm định' },
  { value: 'changes_requested', label: 'Chờ nhà tuyển dụng sửa' },
]

export default function CompanyUpdateFilters({
  companyFilter,
  loading,
  ordering,
  status,
  queryText,
  total,
  onClearCompany,
  onOrderingChange,
  onStatusChange,
  onSearchChange,
}) {
  return (
    <div className="company-filters">
      <div className="company-filters__controls company-filters__controls--queue">
        <Input
          allowClear
          className="company-filters__search"
          size="large"
          prefix={<SearchOutlined className="text-slate-400" />}
          aria-label="Tìm yêu cầu cập nhật"
          placeholder="Tìm email người gửi, tên công ty hoặc mã số thuế"
          value={queryText}
          onChange={onSearchChange}
        />
        <Select
          aria-label="Lọc trạng thái yêu cầu cập nhật"
          size="large"
          value={status}
          options={STATUS_OPTIONS}
          onChange={onStatusChange}
        />
        <Select
          aria-label="Sắp xếp yêu cầu cập nhật"
          size="large"
          value={ordering}
          prefix={<SortAscendingOutlined className="text-slate-400" />}
          options={ORDERING_OPTIONS}
          onChange={onOrderingChange}
        />
      </div>
      <div className="company-filters__meta">
        <span className="company-filters__count">
          {loading ? 'Đang tải hàng đợi…' : (
            <>
              <strong>{Number(total || 0).toLocaleString('vi-VN')}</strong>
              {' yêu cầu theo trạng thái đã chọn'}
            </>
          )}
        </span>
        {companyFilter && (
          <div className="company-filters__chips">
            <Tag closable className="company-filters__chip" onClose={onClearCompany}>
              <span>Mã công ty:</span>
              {' '}
              {companyFilter}
            </Tag>
            <Tooltip title="Bỏ giới hạn theo công ty">
              <Button type="link" size="small" onClick={onClearCompany}>
                Xóa bộ lọc
              </Button>
            </Tooltip>
          </div>
        )}
      </div>
    </div>
  )
}
