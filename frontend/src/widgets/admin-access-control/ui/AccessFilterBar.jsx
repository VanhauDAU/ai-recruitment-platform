import { CloseOutlined, FilterOutlined, SearchOutlined } from '@ant-design/icons'
import { Badge, Button, Input, Popover, Tooltip, Typography } from 'antd'

export default function AccessFilterBar({
  action,
  activeFilters = 0,
  children,
  onClear,
  onSearchChange,
  resultCount,
  search,
  searchLabel,
  searchPlaceholder,
}) {
  return (
    <div className="flex flex-col gap-3 border-y border-slate-100 bg-slate-50/70 px-3 py-3 sm:flex-row sm:items-center">
      <Input
        allowClear
        className="min-h-11 flex-1 bg-white sm:max-w-md"
        prefix={<SearchOutlined className="text-slate-400" />}
        placeholder={searchPlaceholder}
        value={search}
        onChange={(event) => onSearchChange(event.target.value)}
        aria-label={searchLabel}
      />
      <div className="flex items-center gap-2 sm:ml-auto">
        <Popover
          title="Bộ lọc"
          trigger="click"
          placement="bottomRight"
          content={<div className="w-72 space-y-4">{children}</div>}
        >
          <Badge count={activeFilters} size="small" offset={[-2, 3]}>
            <Button className="min-h-11 min-w-11" icon={<FilterOutlined />} aria-label="Mở bộ lọc" />
          </Badge>
        </Popover>
        {activeFilters > 0 && (
          <Tooltip title="Xoá toàn bộ bộ lọc">
            <Button
              type="text"
              className="min-h-11 min-w-11"
              icon={<CloseOutlined />}
              aria-label="Xoá toàn bộ bộ lọc"
              onClick={onClear}
            />
          </Tooltip>
        )}
        <Typography.Text type="secondary" className="ml-1 whitespace-nowrap text-xs">
          {resultCount} kết quả
        </Typography.Text>
        {action}
      </div>
    </div>
  )
}
