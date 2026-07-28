import {
  FilterOutlined,
  SearchOutlined,
  SortAscendingOutlined,
} from '@ant-design/icons'
import {
  Badge,
  Button,
  Drawer,
  Grid,
  Input,
  Popover,
  Select,
  Tag,
  Tooltip,
} from 'antd'
import { useState } from 'react'

const COMPANY_STATUS_OPTIONS = [
  { value: '', label: 'Tất cả trạng thái công ty' },
  { value: 'unverified', label: 'Chưa xác thực' },
  { value: 'pending', label: 'Chờ duyệt' },
  { value: 'verified', label: 'Đã xác thực' },
  { value: 'rejected', label: 'Bị từ chối' },
]

const RECRUITER_STATUS_OPTIONS = [
  { value: '', label: 'Mọi trạng thái NTD' },
  { value: 'none', label: 'Chưa có hồ sơ' },
  { value: 'draft', label: 'Chưa nộp' },
  { value: 'pending', label: 'Chờ duyệt' },
  { value: 'in_review', label: 'Đang xử lý' },
  { value: 'changes_requested', label: 'Cần bổ sung' },
  { value: 'approved', label: 'Đã xác thực' },
  { value: 'rejected', label: 'Bị từ chối' },
]

const MEMBER_ROLE_OPTIONS = [
  { value: '', label: 'Mọi vai trò NTD' },
  { value: 'owner', label: 'Owner' },
  { value: 'member', label: 'Member' },
]

const ORDERING_OPTIONS = [
  { value: '-updated_at', label: 'Cập nhật gần nhất' },
  { value: 'company_name', label: 'Tên công ty A–Z' },
  { value: '-company_name', label: 'Tên công ty Z–A' },
  { value: '-recruiter_count', label: 'Nhiều NTD nhất' },
  { value: '-pending_update_count', label: 'Nhiều yêu cầu nhất' },
]

function optionLabel(options, value) {
  if (!value) return undefined
  return options.find((option) => option.value === value)?.label
}

export default function CompanyDirectoryFilters({
  filters,
  loading,
  ordering,
  searchInput,
  total,
  onClear,
  onPatch,
  onSearchChange,
}) {
  const [advancedOpen, setAdvancedOpen] = useState(false)
  const isCompact = !Grid.useBreakpoint().md
  const advancedCount = [
    filters.recruiter_verification_status,
    filters.member_role,
  ].filter(Boolean).length
  const chips = [
    ['q', 'Từ khóa', filters.q],
    [
      'verification_status',
      'Trạng thái công ty',
      optionLabel(COMPANY_STATUS_OPTIONS, filters.verification_status),
    ],
    [
      'recruiter_verification_status',
      'Xác thực NTD',
      optionLabel(RECRUITER_STATUS_OPTIONS, filters.recruiter_verification_status),
    ],
    ['member_role', 'Vai trò NTD', optionLabel(MEMBER_ROLE_OPTIONS, filters.member_role)],
  ].filter(([, , value]) => Boolean(value))

  const advancedFilters = (
    <div className="company-filter-popover">
      <label className="company-filter-field">
        <span>Xác thực nhà tuyển dụng</span>
        <Select
          aria-label="Lọc xác thực NTD"
          size="large"
          value={filters.recruiter_verification_status}
          options={RECRUITER_STATUS_OPTIONS}
          onChange={(value) => onPatch({ recruiter_verification_status: value })}
        />
      </label>
      <label className="company-filter-field">
        <span>Vai trò trong công ty</span>
        <Select
          aria-label="Lọc vai trò thành viên"
          size="large"
          value={filters.member_role}
          options={MEMBER_ROLE_OPTIONS}
          onChange={(value) => onPatch({ member_role: value })}
        />
      </label>
      <div className="company-filter-popover__footer">
        <span>{advancedCount} điều kiện nâng cao</span>
        <Button type="primary" onClick={() => setAdvancedOpen(false)}>
          Hoàn tất
        </Button>
      </div>
    </div>
  )

  return (
    <div className="company-filters">
      <div className="company-filters__controls">
        <Input
          allowClear
          className="company-filters__search"
          size="large"
          prefix={<SearchOutlined className="text-slate-400" />}
          aria-label="Tìm công ty"
          placeholder="Tìm tên, mã công ty, mã số thuế hoặc email"
          value={searchInput}
          onChange={onSearchChange}
        />
        <Select
          aria-label="Lọc trạng thái công ty"
          size="large"
          value={filters.verification_status}
          options={COMPANY_STATUS_OPTIONS}
          onChange={(value) => onPatch({ verification_status: value })}
        />
        <Select
          aria-label="Sắp xếp danh sách công ty"
          size="large"
          value={ordering}
          prefix={<SortAscendingOutlined className="text-slate-400" />}
          options={ORDERING_OPTIONS}
          onChange={(value) => onPatch({ ordering: value })}
        />
        <Badge count={advancedCount} size="small" offset={[-8, 8]}>
          {isCompact ? (
            <Button
              size="large"
              icon={<FilterOutlined />}
              className="company-filters__advanced"
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
              content={advancedFilters}
              title="Bộ lọc nâng cao"
            >
              <Button
                size="large"
                icon={<FilterOutlined />}
                className="company-filters__advanced"
              >
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
          classNames={{ wrapper: 'company-filter-drawer' }}
        >
          {advancedFilters}
        </Drawer>
      )}

      <div className="company-filters__meta">
        <span className="company-filters__count">
          {loading ? 'Đang tải danh sách…' : (
            <>
              <strong>{Number(total || 0).toLocaleString('vi-VN')}</strong>
              {' công ty'}
              {chips.length ? ' khớp bộ lọc' : ' trong hệ thống'}
            </>
          )}
        </span>
        {chips.length > 0 && (
          <div className="company-filters__chips">
            {chips.map(([key, label, value]) => (
              <Tag
                key={key}
                closable
                className="company-filters__chip"
                onClose={() => onPatch({ [key]: '' })}
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
