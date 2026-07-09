import { CloseOutlined, DownOutlined, InfoCircleFilled, UpOutlined } from '@ant-design/icons'

export function PlaceHighlight({ children }) {
  return (
    <span className="rounded bg-amber-100 px-1 font-semibold text-amber-900 ring-1 ring-amber-200/70">
      {children}
    </span>
  )
}

export function PlaceList({ items }) {
  return items.map((item, index) => (
    <span key={item}>
      {index > 0 && ', '}
      <PlaceHighlight>{item}</PlaceHighlight>
    </span>
  ))
}

export default function LocationMergeNotice({
  expanded,
  mergedFrom,
  onClose,
  onToggleExpanded,
  provinceName,
  selectedWardNames,
}) {
  return (
    <div className="mt-4 flex items-start gap-2.5 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
      <InfoCircleFilled className="mt-0.5 shrink-0 text-amber-500" />
      <div className="min-w-0 flex-1">
        <span className={expanded ? '' : 'line-clamp-1'}>
          <b>Lưu ý:</b> Từ ngày 1/7/2025,{' '}
          {mergedFrom.length ? (
            <>
              <PlaceHighlight>{provinceName}</PlaceHighlight> sau sáp nhập bao gồm phạm vi các tỉnh{' '}
              <PlaceList items={mergedFrom} /> cũ. Danh sách bên dưới hiển thị các việc làm tại{' '}
              <PlaceHighlight>{provinceName}</PlaceHighlight> mới, phù hợp với nhu cầu tìm việc theo đơn vị hành chính
              mới.
            </>
          ) : (
            <>
              <PlaceHighlight>{provinceName}</PlaceHighlight> điều chỉnh mô hình hành chính từ quận/huyện sang{' '}
              <PlaceHighlight>phường/xã</PlaceHighlight>. Danh sách bên dưới hiển thị các việc làm tại{' '}
              <PlaceHighlight>{provinceName}</PlaceHighlight> theo địa danh hành chính mới, phù hợp với nhu cầu tìm
              việc theo đơn vị hành chính mới.
            </>
          )}
          {selectedWardNames.length > 0 && (
            <>
              {' '}Khu vực đã chọn: <PlaceList items={selectedWardNames} />.
            </>
          )}
        </span>
        <button
          type="button"
          onClick={onToggleExpanded}
          className="ml-1 inline-flex cursor-pointer items-center gap-0.5 font-semibold text-amber-600 hover:text-amber-700"
        >
          {expanded ? 'Thu gọn' : 'Xem thêm'}
          {expanded ? <UpOutlined className="text-[10px]" /> : <DownOutlined className="text-[10px]" />}
        </button>
      </div>
      <button
        type="button"
        aria-label="Đóng thông báo"
        onClick={onClose}
        className="shrink-0 cursor-pointer p-0.5 text-amber-400 hover:text-amber-600"
      >
        <CloseOutlined className="text-xs" />
      </button>
    </div>
  )
}
