import { Segmented } from 'antd'
import { useState } from 'react'
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { AdminPanel } from '@/shared/ui/admin'
import { ACTIVITY_METRICS, formatNumber } from '../model/dashboard-model'

const SERIES_COLOR = '#2a78d6'
const axisDate = new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit' })
const fullDate = new Intl.DateTimeFormat('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit' })
const parseDate = (value) => new Date(`${value}T00:00:00`)

function TrendTooltip({ active, payload, metric }) {
  if (!active || !payload?.length) return null
  const item = payload[0].payload
  return (
    <div className="admin-home-tooltip">
      <p className="admin-home-tooltip__date">{fullDate.format(parseDate(item.date))}</p>
      <p><strong>{formatNumber(item[metric.key])}</strong> {metric.unit}</p>
    </div>
  )
}

export default function ActivityTrend({ activity, days }) {
  const [metricKey, setMetricKey] = useState(ACTIVITY_METRICS[0].key)
  const metric = ACTIVITY_METRICS.find((item) => item.key === metricKey)
  const values = activity.map((item) => Number(item[metricKey] || 0))
  const total = values.reduce((sum, value) => sum + value, 0)
  const peakIndex = values.indexOf(Math.max(...values))

  return (
    <AdminPanel
      className="admin-home-trend"
      title="Xu hướng hoạt động"
      description={`${formatNumber(total)} ${metric.unit} trong ${days} ngày, trung bình ${formatNumber(Math.round((total / (days || 1)) * 10) / 10)}/ngày`}
      extra={(
        <Segmented
          size="small"
          value={metricKey}
          onChange={setMetricKey}
          options={ACTIVITY_METRICS.map((item) => ({ label: item.label, value: item.key }))}
          aria-label="Chọn chỉ số"
        />
      )}
    >
      <div
        className="admin-home-trend__chart"
        role="img"
        aria-label={`Biểu đồ ${metric.label.toLowerCase()} theo ngày, tổng ${total}${total ? `, cao nhất ngày ${axisDate.format(parseDate(activity[peakIndex].date))}` : ''}`}
      >
        <ResponsiveContainer width="100%" height="100%" minWidth={0} initialDimension={{ width: 720, height: 260 }}>
          <AreaChart data={activity} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
            <defs>
              <linearGradient id="adminHomeTrendFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={SERIES_COLOR} stopOpacity={0.18} />
                <stop offset="100%" stopColor={SERIES_COLOR} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke="#edf1f5" />
            <XAxis
              dataKey="date"
              axisLine={false}
              tickLine={false}
              minTickGap={24}
              tick={{ fill: '#64748b', fontSize: 11 }}
              tickFormatter={(value) => axisDate.format(parseDate(value))}
            />
            <YAxis allowDecimals={false} axisLine={false} tickLine={false} width={40} tick={{ fill: '#64748b', fontSize: 11 }} />
            <Tooltip content={<TrendTooltip metric={metric} />} cursor={{ stroke: '#94a3b8', strokeWidth: 1 }} />
            <Area
              type="monotone"
              dataKey={metricKey}
              stroke={SERIES_COLOR}
              strokeWidth={2}
              fill="url(#adminHomeTrendFill)"
              dot={false}
              activeDot={{ r: 5, fill: SERIES_COLOR, stroke: '#fff', strokeWidth: 2 }}
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <details className="admin-home-trend__table">
        <summary>Xem số liệu theo ngày</summary>
        <div className="admin-home-trend__table-scroll">
          <table>
            <thead>
              <tr>
                <th scope="col">Ngày</th>
                {ACTIVITY_METRICS.map((item) => <th key={item.key} scope="col">{item.label}</th>)}
              </tr>
            </thead>
            <tbody>
              {[...activity].reverse().map((row) => (
                <tr key={row.date}>
                  <th scope="row">{axisDate.format(parseDate(row.date))}</th>
                  {ACTIVITY_METRICS.map((item) => <td key={item.key}>{formatNumber(row[item.key])}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </AdminPanel>
  )
}
