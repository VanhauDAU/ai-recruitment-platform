import { BellOutlined, RightOutlined } from '@ant-design/icons'
import { Skeleton, Tooltip } from 'antd'
import { Link } from 'react-router-dom'
import { formatNumber } from '@/constants/jobOptions'

export default function JobListHeader({
  catChain,
  contextLabel,
  count,
  fullContextLabel,
  fullLocationSummary,
  hasSelectedLocation,
  isLocationContext,
  loading,
  locationSummary,
  onCategorySelect,
  onJumpToResults,
  onLocationPickerOpen,
  onSuggestedLocationSelect,
  activeSearchKeyword,
  searchSuggestion,
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
        {hasSelectedLocation ? (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {locationSummary ? (
              <button
                type="button"
                onClick={onJumpToResults}
                title={fullLocationSummary ? `Xem việc làm tại ${fullLocationSummary}` : undefined}
                className="group inline-flex max-w-full cursor-pointer flex-wrap items-center gap-x-1.5 gap-y-1 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-left text-sm text-gray-700 shadow-sm transition hover:border-[var(--brand-primary)] hover:bg-white sm:rounded-full sm:px-4"
              >
                {loading ? (
                  <>
                    <span>Đang tìm việc làm phù hợp tại</span>
                    <strong className="text-gray-900">{locationSummary}</strong>
                    <span>...</span>
                  </>
                ) : (
                  <>
                    <span>Có</span>
                    <strong className="text-gray-900">{formatNumber(count)} việc làm</strong>
                    {activeSearchKeyword && (
                      <strong className="max-w-56 truncate text-gray-900" title={activeSearchKeyword}>
                        “{activeSearchKeyword}”
                      </strong>
                    )}
                    <span>tại</span>
                    <strong className="max-w-64 truncate text-gray-900">{locationSummary}.</strong>
                    <span className="font-semibold text-[var(--brand-primary)] group-hover:underline">Xem ngay →</span>
                  </>
                )}
              </button>
            ) : (
              <span className="inline-flex rounded-full border border-gray-200 bg-gray-50 px-4 py-2 text-sm text-gray-500">
                Đang cập nhật địa điểm...
              </span>
            )}
            <button
              type="button"
              onClick={onLocationPickerOpen}
              className="cursor-pointer px-1 py-1 text-sm font-medium text-gray-500 hover:text-[var(--brand-primary)] hover:underline"
            >
              Đổi địa điểm
            </button>
          </div>
        ) : searchSuggestion ? (
          <div className="mt-2 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-sm text-gray-600">
            <span>Xem việc làm</span>
            <span className="max-w-56 truncate font-semibold text-gray-900" title={searchSuggestion}>
              {searchSuggestion}
            </span>
            <span>tại</span>
            <button
              type="button"
              onClick={() => onSuggestedLocationSelect('Hà Nội')}
              className="cursor-pointer font-medium text-[var(--brand-primary)] hover:underline"
            >
              Hà Nội
            </button>
            <span className="text-gray-300">|</span>
            <button
              type="button"
              onClick={() => onSuggestedLocationSelect('Hồ Chí Minh')}
              className="cursor-pointer font-medium text-[var(--brand-primary)] hover:underline"
            >
              Hồ Chí Minh
            </button>
            <span className="text-gray-300">|</span>
            <button
              type="button"
              onClick={onLocationPickerOpen}
              className="cursor-pointer font-medium text-[var(--brand-primary)] hover:underline"
            >
              Chọn tỉnh thành của tôi →
            </button>
          </div>
        ) : null}
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
