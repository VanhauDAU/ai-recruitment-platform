import { Empty } from 'antd'
import { useState } from 'react'

const SERIES = [
  { key: 'impressions', label: 'Lượt hiển thị', color: '#25364a' },
  { key: 'views', label: 'Lượt xem', color: '#3478f6' },
  { key: 'applications', label: 'Lượt ứng tuyển', color: '#00a854' },
]

const VIETNAMESE_NUMBER = new Intl.NumberFormat('vi-VN')

function numberValue(value) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function parseChartDate(value) {
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (dateOnly) {
    const [, year, month, day] = dateOnly
    return {
      date: new Date(Number(year), Number(month) - 1, Number(day), 0, 0),
      isDateOnly: true,
    }
  }

  return { date: new Date(value), isDateOnly: false }
}

function dateParts(value) {
  const { date, isDateOnly } = parseChartDate(value)
  if (Number.isNaN(date.getTime())) return { short: '', detailed: '' }

  const day = String(date.getDate()).padStart(2, '0')
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const year = date.getFullYear()
  const hours = isDateOnly ? '00' : String(date.getHours()).padStart(2, '0')
  const minutes = isDateOnly ? '00' : String(date.getMinutes()).padStart(2, '0')

  return {
    short: `${day}/${month}`,
    detailed: `${day}/${month}/${year} ${hours}:${minutes}`,
  }
}

export default function CampaignPerformanceChart({ data }) {
  const [activeIndex, setActiveIndex] = useState(null)
  const width = 900
  const height = 248
  const padding = { top: 20, right: 24, bottom: 44, left: 48 }
  const chartWidth = width - padding.left - padding.right
  const chartHeight = height - padding.top - padding.bottom
  const availableData = data.filter((item) => item.available)
  const maximum = Math.max(
    ...availableData.flatMap((item) => SERIES.map((series) => numberValue(item[series.key]))),
    1,
  )
  const step = data.length > 1 ? chartWidth / (data.length - 1) : chartWidth
  const pointFor = (item, index, key) => ({
    x: padding.left + (index * step),
    y: padding.top + chartHeight - ((numberValue(item[key]) / maximum) * chartHeight),
  })
  const labelEvery = Math.max(1, Math.ceil(data.length / 8))
  const activeItem = activeIndex === null ? null : data[activeIndex]
  const activeX = activeItem ? pointFor(activeItem, activeIndex, 'impressions').x : null
  const tooltipWidth = 188
  const tooltipHeight = 124
  const tooltipX = activeX === null
    ? 0
    : activeX + 16 + tooltipWidth <= width - padding.right
      ? activeX + 16
      : Math.max(padding.left, activeX - tooltipWidth - 16)
  const activeTopY = activeItem
    ? Math.min(...SERIES.map((series) => pointFor(activeItem, activeIndex, series.key).y))
    : padding.top
  const tooltipY = Math.min(
    Math.max(activeTopY - 56, padding.top + 8),
    padding.top + chartHeight - tooltipHeight - 8,
  )

  if (!availableData.length) {
    return (
      <Empty
        className="flex min-h-60 flex-col justify-center"
        image={Empty.PRESENTED_IMAGE_SIMPLE}
        description="Chưa đến thời điểm bắt đầu ghi nhận dữ liệu"
      />
    )
  }

  return (
    <div className="overflow-x-auto pb-1" data-testid="campaign-performance-chart">
      <div className="min-w-[680px]">
        <svg
          role="img"
          aria-label="Biểu đồ lượt hiển thị, lượt xem và lượt ứng tuyển"
          viewBox={`0 0 ${width} ${height}`}
          className="h-64 w-full"
          onMouseLeave={() => setActiveIndex(null)}
        >
          {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
            const y = padding.top + (chartHeight * ratio)
            const value = Math.round(maximum * (1 - ratio))
            return (
              <g key={ratio}>
                <line x1={padding.left} x2={width - padding.right} y1={y} y2={y} stroke="#e2e8f0" strokeWidth="1" />
                <text x={padding.left - 12} y={y + 4} textAnchor="end" fill="#94a3b8" fontSize="11">{value}</text>
              </g>
            )
          })}

          {SERIES.map((series) => {
            const points = data
              .map((item, index) => ({ item, ...pointFor(item, index, series.key) }))
              .filter(({ item }) => item.available)
            return (
              <g key={series.key}>
                {points.length > 1 && (
                  <polyline
                    points={points.map((point) => `${point.x},${point.y}`).join(' ')}
                    fill="none"
                    stroke={series.color}
                    strokeWidth="2.5"
                    strokeLinejoin="round"
                    strokeLinecap="round"
                  />
                )}
                {points.map((point) => (
                  <circle key={`${series.key}-${point.item.date}`} cx={point.x} cy={point.y} r="3" fill="#fff" stroke={series.color} strokeWidth="2" />
                ))}
              </g>
            )
          })}

          {activeItem?.available && (
            <g data-testid="campaign-chart-active-marker" pointerEvents="none">
              <line
                x1={activeX}
                x2={activeX}
                y1={padding.top}
                y2={padding.top + chartHeight}
                stroke="#94a3b8"
                strokeDasharray="4 4"
                strokeWidth="1"
              />
              {SERIES.map((series) => {
                const point = pointFor(activeItem, activeIndex, series.key)
                return (
                  <circle
                    key={`active-${series.key}`}
                    cx={point.x}
                    cy={point.y}
                    r="5"
                    fill={series.color}
                    stroke="#fff"
                    strokeWidth="2"
                  />
                )
              })}
            </g>
          )}

          {data.map((item, index) => {
            if (index % labelEvery !== 0 && index !== data.length - 1) return null
            const point = pointFor(item, index, 'impressions')
            return (
              <text key={item.date} x={point.x} y={height - 14} textAnchor="middle" fill="#64748b" fontSize="11">
                {dateParts(item.date).short}
              </text>
            )
          })}

          {data.map((item, index) => {
            if (!item.available) return null

            const x = pointFor(item, index, 'impressions').x
            const previousX = index > 0 ? pointFor(data[index - 1], index - 1, 'impressions').x : padding.left
            const nextX = index < data.length - 1 ? pointFor(data[index + 1], index + 1, 'impressions').x : width - padding.right
            const hitX = index === 0 ? padding.left : (previousX + x) / 2
            const hitRight = index === data.length - 1 ? width - padding.right : (x + nextX) / 2
            const detailedDate = dateParts(item.date).detailed

            return (
              <rect
                key={`hit-${item.date}`}
                data-testid={`campaign-chart-hit-${index}`}
                x={hitX}
                y={padding.top}
                width={Math.max(hitRight - hitX, 1)}
                height={chartHeight}
                fill="transparent"
                pointerEvents="all"
                className="cursor-crosshair outline-none"
                role="button"
                tabIndex={0}
                aria-label={`Xem số liệu ngày ${detailedDate}`}
                onMouseEnter={() => setActiveIndex(index)}
                onFocus={() => setActiveIndex(index)}
                onBlur={() => setActiveIndex(null)}
                onClick={() => setActiveIndex(index)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    setActiveIndex(index)
                  }
                  if (event.key === 'Escape') setActiveIndex(null)
                }}
              />
            )
          })}

          {activeItem?.available && (
            <foreignObject
              x={tooltipX}
              y={tooltipY}
              width={tooltipWidth}
              height={tooltipHeight}
              pointerEvents="none"
            >
              <div
                role="tooltip"
                data-testid="campaign-performance-tooltip"
                className="rounded-md border border-slate-200 bg-white px-3 py-2.5 text-xs text-slate-600 shadow-lg"
              >
                <p className="mb-2 font-medium text-slate-700">{dateParts(activeItem.date).detailed}</p>
                <div className="space-y-1.5">
                  {SERIES.map((series) => (
                    <div key={`tooltip-${series.key}`} className="flex items-center gap-2">
                      <span
                        className="h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{ backgroundColor: series.color }}
                      />
                      <span className="min-w-0 flex-1">{series.label}</span>
                      <strong className="font-semibold text-slate-700">
                        {VIETNAMESE_NUMBER.format(numberValue(activeItem[series.key]))}
                      </strong>
                    </div>
                  ))}
                </div>
              </div>
            </foreignObject>
          )}
        </svg>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 px-12 text-xs text-slate-600">
          {SERIES.map((series) => (
            <span key={series.key} className="inline-flex items-center gap-2">
              <span className="h-0.5 w-5" style={{ backgroundColor: series.color }} />
              {series.label}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}
