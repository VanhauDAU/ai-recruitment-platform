import { DownOutlined } from '@ant-design/icons'
import { useState } from 'react'

export default function WardSuggestionCard({ wards, onSelect }) {
  const [expanded, setExpanded] = useState(false)
  if (!wards.length) return null

  const visibleWards = expanded ? wards : wards.slice(0, 3)
  const canExpand = wards.length > 3

  return (
    <div className="rounded-xl border border-gray-100 bg-white px-4 py-3 shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-gray-800">Gợi ý phường xã:</h3>
        {canExpand && (
          <button
            type="button"
            aria-label={expanded ? 'Thu gọn gợi ý phường xã' : 'Xem thêm gợi ý phường xã'}
            onClick={() => setExpanded((value) => !value)}
            className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-full text-gray-400 transition hover:bg-gray-100 hover:text-[var(--brand-primary)]"
          >
            <DownOutlined className={`text-xs transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`} />
          </button>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        {visibleWards.map((ward) => (
          <button
            key={ward.id}
            type="button"
            onClick={() => onSelect(ward.id)}
            className="cursor-pointer rounded-full border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 transition hover:border-[var(--brand-primary)] hover:bg-green-50 hover:text-[var(--brand-primary)]"
          >
            {ward.name}
            {ward.provinceName && <span className="ml-1 text-gray-400">tại {ward.provinceName}</span>}
          </button>
        ))}
      </div>
    </div>
  )
}
