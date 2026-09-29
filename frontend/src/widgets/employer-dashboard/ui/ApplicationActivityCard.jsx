import { RiseOutlined } from '@ant-design/icons'
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

const axisDateFormatter = new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit' })
const fullDateFormatter = new Intl.DateTimeFormat('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit' })
const numberFormatter = new Intl.NumberFormat('vi-VN')

function parseDate(value) {
  return new Date(`${value}T00:00:00`)
}

function ActivityTooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  const item = payload[0].payload
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-3.5 py-3 shadow-xl">
      <p className="text-[11px] capitalize text-slate-400">{fullDateFormatter.format(parseDate(item.date))}</p>
      <p className="mt-1 text-xs text-slate-600"><strong className="text-base text-slate-900">{numberFormatter.format(item.count)}</strong> hồ sơ mới</p>
    </div>
  )
}

export default function ApplicationActivityCard({ activity = [] }) {
  const weeklyTotal = activity.reduce((total, item) => total + Number(item.count || 0), 0)
  const peak = Math.max(0, ...activity.map((item) => Number(item.count || 0)))
  const average = activity.length ? Math.round((weeklyTotal / activity.length) * 10) / 10 : 0
  const chartData = activity.map((item) => ({ ...item, count: Number(item.count || 0) }))

  return (
    <section className="overflow-hidden rounded-[20px] border border-slate-200/80 bg-white shadow-[0_12px_35px_-24px_rgba(15,23,42,.45)]" aria-labelledby="activity-title">
      <div className="flex flex-col gap-4 px-5 pb-2 pt-5 sm:flex-row sm:items-start sm:justify-between sm:px-6 sm:pt-6">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600"><RiseOutlined /></span>
            <div>
              <h2 id="activity-title" className="text-lg font-black text-slate-900">Xu hướng hồ sơ ứng tuyển</h2>
              <p className="mt-0.5 text-xs text-slate-500">Dữ liệu 7 ngày gần nhất</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-5 sm:text-right">
          <div><span className="block text-[10px] font-bold uppercase tracking-wide text-slate-400">Tuần này</span><strong className="mt-0.5 block text-lg font-black text-slate-900">{numberFormatter.format(weeklyTotal)}</strong></div>
          <div className="h-8 w-px bg-slate-200" />
          <div><span className="block text-[10px] font-bold uppercase tracking-wide text-slate-400">Trung bình/ngày</span><strong className="mt-0.5 block text-lg font-black text-slate-900">{numberFormatter.format(average)}</strong></div>
        </div>
      </div>

      <div className="h-[285px] w-full px-1 pb-1 pt-3 sm:px-3" role="img" aria-label={`Biểu đồ đường cong hồ sơ ứng tuyển 7 ngày, tổng ${weeklyTotal} hồ sơ`}>
        <ResponsiveContainer width="100%" height="100%" minWidth={0} initialDimension={{ width: 760, height: 270 }}>
          <AreaChart data={chartData} margin={{ top: 12, right: 12, left: -22, bottom: 4 }}>
            <defs>
              <linearGradient id="dashboardApplicationGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#10b981" stopOpacity={0.32} />
                <stop offset="70%" stopColor="#10b981" stopOpacity={0.07} />
                <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke="#e8eef3" strokeDasharray="4 6" />
            <XAxis
              dataKey="date"
              axisLine={false}
              tickLine={false}
              tick={{ fill: '#94a3b8', fontSize: 11 }}
              tickFormatter={(value) => axisDateFormatter.format(parseDate(value))}
              dy={8}
            />
            <YAxis
              allowDecimals={false}
              axisLine={false}
              tickLine={false}
              tick={{ fill: '#94a3b8', fontSize: 11 }}
              width={42}
            />
            <Tooltip content={<ActivityTooltip />} cursor={{ stroke: '#94a3b8', strokeWidth: 1, strokeDasharray: '3 4' }} />
            <Area
              type="monotone"
              dataKey="count"
              stroke="#059669"
              strokeWidth={3}
              fill="url(#dashboardApplicationGradient)"
              dot={{ r: 3.5, fill: '#fff', stroke: '#059669', strokeWidth: 2 }}
              activeDot={{ r: 6, fill: '#059669', stroke: '#fff', strokeWidth: 3 }}
              connectNulls
              animationDuration={1000}
              animationEasing="ease-out"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-3 border-t border-slate-100 bg-slate-50/60">
        <ChartStat label="Cao nhất/ngày" value={peak} />
        <ChartStat label="Tổng 7 ngày" value={weeklyTotal} />
        <ChartStat label="Ngày có hồ sơ" value={activity.filter((item) => item.count > 0).length} suffix={`/ ${activity.length || 7}`} />
      </div>
    </section>
  )
}

function ChartStat({ label, value, suffix = '' }) {
  return (
    <div className="min-w-0 px-3 py-3 text-center sm:px-5 sm:py-4">
      <span className="block truncate text-[10px] font-bold uppercase tracking-wide text-slate-400">{label}</span>
      <strong className="mt-1 block text-sm font-black text-slate-800">{numberFormatter.format(value)}{suffix}</strong>
    </div>
  )
}
