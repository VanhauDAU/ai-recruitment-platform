import { BellOutlined, RightOutlined } from '@ant-design/icons'
import { Skeleton, Tooltip } from 'antd'
import { Link } from 'react-router-dom'
import { formatNumber } from '../../../../constants/jobOptions'

export default function JobListHeader({
  catChain,
  contextLabel,
  count,
  fullContextLabel,
  fullLocationSummary,
  isLocationContext,
  loading,
  locationSummary,
  onCategorySelect,
  updateLabel,
}) {
  return (
    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
      <div className="min-w-0 flex-1">
        <h1 className="flex min-w-0 items-center gap-x-1.5 overflow-hidden whitespace-nowrap text-lg font-semibold text-gray-900">
          <span className="shrink-0">Tuyển dụng</span>
          {loading ? (
            <Skeleton.Input active size="small" style={{ width: 90, verticalAlign: 'middle' }} />
          ) : (
            <span className="shrink-0 text-[var(--brand-primary)]">{formatNumber(count)} việc làm</span>
          )}
          {!loading && contextLabel && (
            <Tooltip title={fullContextLabel || contextLabel}>
              <span className={`min-w-0 truncate ${isLocationContext ? 'text-[var(--brand-primary)]' : ''}`}>
                {contextLabel}
              </span>
            </Tooltip>
          )}
          <span className="shrink-0 text-sm font-semibold text-gray-700">{updateLabel}</span>
        </h1>
        <nav className="mt-1 flex min-w-0 items-center gap-1.5 overflow-hidden whitespace-nowrap text-sm text-gray-500">
          <Link to="/" className="shrink-0 hover:text-[var(--brand-primary)]">Trang chủ</Link>
          <RightOutlined className="shrink-0 text-[10px] text-gray-300" />
          {locationSummary ? (
            <>
              <Link to="/viec-lam" className="shrink-0 hover:text-[var(--brand-primary)]">Việc làm</Link>
              <RightOutlined className="shrink-0 text-[10px] text-gray-300" />
              <Tooltip title={`${fullLocationSummary} mới (sau sáp nhập)`}>
                <span className="min-w-0 truncate text-gray-700">
                  {locationSummary} mới (sau sáp nhập)
                </span>
              </Tooltip>
            </>
          ) : catChain.length === 0 ? (
            <span>Việc làm</span>
          ) : (
            catChain.map((category, index) => (
              <span key={category.id} className="flex items-center gap-1.5">
                {index > 0 && <RightOutlined className="text-[10px] text-gray-300" />}
                {index < catChain.length - 1 ? (
                  <button
                    type="button"
                    onClick={() => onCategorySelect(category.id)}
                    className="cursor-pointer hover:text-[var(--brand-primary)]"
                  >
                    {index === 0 ? `Việc làm ${category.name}` : category.name}
                  </button>
                ) : (
                  <span className="text-gray-700">{index === 0 ? `Việc làm ${category.name}` : category.name}</span>
                )}
              </span>
            ))
          )}
        </nav>
      </div>
      <span
        title="Sắp ra mắt"
        className="inline-flex w-fit shrink-0 cursor-not-allowed items-center gap-2 rounded-full border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-600"
      >
        <BellOutlined /> Tạo thông báo việc làm
      </span>
    </div>
  )
}
