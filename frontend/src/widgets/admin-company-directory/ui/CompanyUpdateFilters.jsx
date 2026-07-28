import { SearchOutlined, SortAscendingOutlined } from '@ant-design/icons'
import { Button, Input, Select, Tag, Tooltip } from 'antd'

const ORDERING_OPTIONS = [
  { value: '-updated_at', label: 'Tiếp nhận gần nhất' },
  { value: 'updated_at', label: 'Tiếp nhận lâu nhất' },
  { value: 'company__company_name', label: 'Tên công ty A–Z' },
  { value: '-change_count', label: 'Nhiều thay đổi nhất' },
  { value: '-is_sensitive', label: 'Ưu tiên thay đổi pháp lý' },
]

export default function CompanyUpdateFilters({
  companyFilter,
  loading,
  ordering,
  queryText,
  total,
  onClearCompany,
  onOrderingChange,
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
              {' yêu cầu đang chờ xử lý'}
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
