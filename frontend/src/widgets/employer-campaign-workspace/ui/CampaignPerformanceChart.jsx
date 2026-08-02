import { Empty } from 'antd'
import { useEffect, useId, useMemo, useState } from 'react'
import { Area, CartesianGrid, ComposedChart, Line, ResponsiveContainer, XAxis, YAxis } from 'recharts'

const SERIES = [
  { key: 'impressions', label: 'Lượt hiển thị', color: '#059669', axis: 'reach', kind: 'area' },
  { key: 'views', label: 'Lượt xem', color: '#2563eb', axis: 'response', kind: 'line' },
  { key: 'applications', label: 'Lượt ứng tuyển', color: '#7c3aed', axis: 'response', kind: 'line' },
]
const VIETNAMESE_NUMBER = new Intl.NumberFormat('vi-VN')
const COMPACT_NUMBER = new Intl.NumberFormat('vi-VN', { notation: 'compact', maximumFractionDigits: 1 })
const CHART_LABEL = 'Biểu đồ lượt hiển thị, lượt xem và lượt ứng tuyển'

function numberValue(value) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function dateParts(value) {
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  const date = dateOnly
    ? new Date(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3]), 0, 0)
    : new Date(value)
  if (Number.isNaN(date.getTime())) return { short: '', full: '', detailed: '' }

  const day = String(date.getDate()).padStart(2, '0')
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const year = date.getFullYear()
  const hours = dateOnly ? '00' : String(date.getHours()).padStart(2, '0')
  const minutes = dateOnly ? '00' : String(date.getMinutes()).padStart(2, '0')
  return {
    short: `${day}/${month}`,
    full: `${day}/${month}/${year}`,
    detailed: `${day}/${month}/${year} ${hours}:${minutes}`,
  }
}

function formatAxisNumber(value) {
  const parsed = numberValue(value)
  return Math.abs(parsed) >= 1000 ? COMPACT_NUMBER.format(parsed) : VIETNAMESE_NUMBER.format(parsed)
}

function usePrefersReducedMotion() {
  const [reducedMotion, setReducedMotion] = useState(() => (
    typeof window !== 'undefined'
      && Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)
  ))
  useEffect(() => {
    const media = window.matchMedia?.('(prefers-reduced-motion: reduce)')
    if (!media) return undefined

    const updatePreference = () => setReducedMotion(media.matches)
    updatePreference()
    if (media.addEventListener) {
      media.addEventListener('change', updatePreference)
      return () => media.removeEventListener('change', updatePreference)
    }
    media.addListener?.(updatePreference)
    return () => media.removeListener?.(updatePreference)
  }, [])
  return reducedMotion
}

function interactionBounds(index, length) {
  if (length <= 1) return { left: 0, width: 100, point: 50 }
  const step = 100 / (length - 1)
  const left = index === 0 ? 0 : (index - 0.5) * step
  const right = index === length - 1 ? 100 : (index + 0.5) * step
  return { left, width: right - left, point: index * step }
}

function pointLabel(item) {
  const values = SERIES.map((series) => (
    `${series.label} ${VIETNAMESE_NUMBER.format(numberValue(item[series.key]))}`
  )).join(', ')
  return `Xem số liệu ngày ${dateParts(item.date).detailed}: ${values}`
}

function chartSummary(availableData) {
  const first = availableData[0]
  const latest = availableData.at(-1)
  if (!first || !latest) return 'Chưa có dữ liệu hiệu quả tuyển dụng.'
  return [
    `${availableData.length} ngày có dữ liệu từ ${dateParts(first.date).full} đến ${dateParts(latest.date).full}.`,
    `Ngày gần nhất có ${VIETNAMESE_NUMBER.format(numberValue(latest.impressions))} lượt hiển thị,`,
    `${VIETNAMESE_NUMBER.format(numberValue(latest.views))} lượt xem và`,
    `${VIETNAMESE_NUMBER.format(numberValue(latest.applications))} lượt ứng tuyển.`,
  ].join(' ')
}

function PerformanceTooltip({ item }) {
  return (
    <div
      role="tooltip"
      data-testid="campaign-performance-tooltip"
      className="w-56 rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-600 shadow-xl"
    >
      <p className="mb-2.5 font-semibold text-slate-800">{dateParts(item.date).detailed}</p>
      <div className="space-y-2">
        {SERIES.map((series) => (
          <div key={series.key} className="flex items-center gap-2.5">
            <span aria-hidden className="h-2.5 w-2.5 shrink-0 rounded-full ring-2 ring-white" style={{ backgroundColor: series.color }} />
            <span className="min-w-0 flex-1">{series.label}</span>
            <strong className="font-semibold tabular-nums text-slate-800">
              {VIETNAMESE_NUMBER.format(numberValue(item[series.key]))}
            </strong>
          </div>
        ))}
      </div>
    </div>
  )
}

function EmptyChart({ summaryId }) {
  return (
    <figure data-testid="campaign-performance-chart" className="min-w-0">
      <div
        role="img"
        aria-label={CHART_LABEL}
        aria-describedby={summaryId}
        className="flex min-h-64 flex-col justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50"
      >
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Chưa đến thời điểm bắt đầu ghi nhận dữ liệu" />
      </div>
      <figcaption id={summaryId} className="sr-only">
        Chưa có dữ liệu hiệu quả tuyển dụng trong khoảng thời gian này.
      </figcaption>
    </figure>
  )
}

export default function CampaignPerformanceChart({ data = [] }) {
  const [activeIndex, setActiveIndex] = useState(null)
  const reducedMotion = usePrefersReducedMotion()
  const generatedId = useId().replaceAll(':', '')
  const summaryId = `campaign-chart-summary-${generatedId}`
  const tooltipId = `campaign-chart-tooltip-${generatedId}`
  const gradientId = `campaign-impressions-gradient-${generatedId}`
  const chartData = useMemo(() => data.map((item) => ({
    ...item,
    impressions: item.available ? numberValue(item.impressions) : null,
    views: item.available ? numberValue(item.views) : null,
    applications: item.available ? numberValue(item.applications) : null,
  })), [data])
  const availableData = chartData.filter((item) => item.available)
  const activeItem = activeIndex === null ? null : chartData[activeIndex]
  const activeBounds = activeIndex === null ? null : interactionBounds(activeIndex, chartData.length)
  const activeOnRight = activeIndex !== null && activeIndex >= (chartData.length / 2)
  const clearActive = () => setActiveIndex(null)
  if (!availableData.length) return <EmptyChart summaryId={summaryId} />

  return (
    <figure data-testid="campaign-performance-chart" className="min-w-0" onMouseLeave={clearActive}>
      <div className="relative overflow-hidden rounded-xl border border-slate-200 bg-gradient-to-b from-white to-slate-50">
        <div
          role="img"
          aria-label={CHART_LABEL}
          aria-describedby={summaryId}
          data-reduced-motion={reducedMotion ? 'true' : 'false'}
          className="h-64 w-full sm:h-72"
          onMouseLeave={clearActive}
        >
          <ResponsiveContainer
            width="100%"
            height="100%"
            minWidth={0}
            debounce={80}
            initialDimension={{ width: 760, height: 300 }}
          >
            <ComposedChart
              data={chartData}
              margin={{ top: 18, right: 6, bottom: 4, left: 0 }}
              accessibilityLayer={false}
            >
              <defs>
                <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={SERIES[0].color} stopOpacity="0.28" />
                  <stop offset="80%" stopColor={SERIES[0].color} stopOpacity="0.035" />
                  <stop offset="100%" stopColor={SERIES[0].color} stopOpacity="0" />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} stroke="#e2e8f0" strokeDasharray="3 5" />
              <XAxis
                dataKey="date"
                axisLine={false}
                tickLine={false}
                tick={{ fill: '#64748b', fontSize: 11 }}
                tickFormatter={(value) => dateParts(value).short}
                minTickGap={28}
                height={30}
              />
              <YAxis
                yAxisId="reach"
                axisLine={false}
                tickLine={false}
                tick={{ fill: '#94a3b8', fontSize: 11 }}
                tickFormatter={formatAxisNumber}
                allowDecimals={false}
                width={46}
              />
              <YAxis
                yAxisId="response"
                orientation="right"
                axisLine={false}
                tickLine={false}
                tick={{ fill: '#94a3b8', fontSize: 11 }}
                tickFormatter={formatAxisNumber}
                allowDecimals={false}
                width={44}
              />
              {SERIES.map((series) => {
                const ChartSeries = series.kind === 'area' ? Area : Line
                return (
                  <ChartSeries
                    key={series.key}
                    type="monotone"
                    yAxisId={series.axis}
                    dataKey={series.key}
                    name={series.label}
                    stroke={series.color}
                    strokeWidth={series.kind === 'area' ? 2.5 : 2.25}
                    fill={series.kind === 'area' ? `url(#${gradientId})` : 'none'}
                    connectNulls={false}
                    dot={false}
                    activeDot={false}
                    isAnimationActive={!reducedMotion}
                    animationDuration={420}
                    animationEasing="ease-out"
                  />
                )
              })}
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        <div className="pointer-events-none absolute inset-x-12 bottom-9 top-5 z-10 sm:right-12">
          {chartData.map((item, index) => {
            const bounds = interactionBounds(index, chartData.length)
            const sharedStyle = { left: `${bounds.left}%`, width: `${bounds.width}%` }
            if (!item.available) {
              return (
                <span
                  key={`unavailable-${item.date}`}
                  aria-hidden
                  className="pointer-events-auto absolute inset-y-0"
                  style={sharedStyle}
                  onMouseEnter={clearActive}
                />
              )
            }
            return (
              <button
                key={`hit-${item.date}`}
                type="button"
                data-testid={`campaign-chart-hit-${index}`}
                aria-label={pointLabel(item)}
                aria-pressed={activeIndex === index}
                aria-describedby={activeIndex === index ? tooltipId : undefined}
                className="pointer-events-auto absolute inset-y-0 cursor-crosshair rounded-sm bg-transparent outline-none transition-colors focus-visible:bg-emerald-50 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-500"
                style={sharedStyle}
                onMouseEnter={() => setActiveIndex(index)}
                onFocus={() => setActiveIndex(index)}
                onBlur={clearActive}
                onClick={() => setActiveIndex(index)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    setActiveIndex(index)
                  }
                  if (event.key === 'Escape') {
                    event.preventDefault()
                    clearActive()
                  }
                }}
              />
            )
          })}
          {activeItem?.available && activeBounds && (
            <span
              aria-hidden
              data-testid="campaign-chart-active-marker"
              className="pointer-events-none absolute inset-y-0 w-px bg-slate-400 shadow-sm"
              style={{ left: `${activeBounds.point}%` }}
            >
              <span className="absolute -left-1.5 -top-0.5 h-3 w-3 rounded-full border-2 border-white bg-emerald-500 shadow" />
            </span>
          )}
        </div>

        {activeItem?.available && (
          <div id={tooltipId} className={`pointer-events-none absolute top-3 z-20 ${activeOnRight ? 'left-14' : 'right-12'}`}>
            <PerformanceTooltip item={activeItem} />
          </div>
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-x-6 gap-y-2 px-1">
        <ul aria-label="Chú giải biểu đồ" className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-slate-600">
          {SERIES.map((series) => (
            <li key={series.key} className="inline-flex items-center gap-2">
              <span className="relative h-2.5 w-5" aria-hidden>
                {series.kind === 'area' && <span className="absolute inset-0 rounded-sm opacity-20" style={{ backgroundColor: series.color }} />}
                <span className="absolute inset-x-0 top-1 h-0.5 rounded-full" style={{ backgroundColor: series.color }} />
              </span>
              {series.label}
            </li>
          ))}
        </ul>
        <span className="hidden text-xs text-slate-400 lg:inline">Di chuột, chạm hoặc dùng Tab để xem từng ngày</span>
      </div>
      <figcaption id={summaryId} className="sr-only">{chartSummary(availableData)}</figcaption>
    </figure>
  )
}
