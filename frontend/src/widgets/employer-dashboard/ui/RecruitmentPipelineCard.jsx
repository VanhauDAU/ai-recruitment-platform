import { ArrowRightOutlined } from '@ant-design/icons'
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import { Link } from 'react-router'
import { employerAppPath } from '@/shared/config/portals'

const PIPELINE_SEGMENTS = [
  { key: 'applications_new', label: 'Mới nhận', color: '#2563eb' },
  { key: 'applications_shortlisted', label: 'Phù hợp', color: '#f59e0b' },
  { key: 'applications_interviewed', label: 'Phỏng vấn', color: '#10b981' },
]

const numberFormatter = new Intl.NumberFormat('vi-VN')

function PipelineTooltip({ active, payload }) {
  if (!active || !payload?.length) return null
  const item = payload[0].payload
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs shadow-xl">
      <span className="text-slate-500">{item.label}</span>
      <strong className="ml-3 text-slate-900">{numberFormatter.format(item.value)} hồ sơ</strong>
    </div>
  )
}

export default function RecruitmentPipelineCard({ summary = {} }) {
  const total = Number(summary.applications_total || 0)
  const trackedTotal = PIPELINE_SEGMENTS.reduce((sum, item) => sum + Number(summary[item.key] || 0), 0)
  const data = [
    ...PIPELINE_SEGMENTS.map((item) => ({ ...item, value: Number(summary[item.key] || 0) })),
    { key: 'other', label: 'Đang xử lý khác', color: '#cbd5e1', value: Math.max(0, total - trackedTotal) },
  ].filter((item) => item.value > 0)
  const chartData = data.length ? data : [{ key: 'empty', label: 'Chưa có hồ sơ', color: '#e2e8f0', value: 1 }]
  const interviewRate = total ? Math.round((Number(summary.applications_interviewed || 0) / total) * 100) : 0

  return (
    <section className="rounded-[20px] border border-slate-200/80 bg-white p-5 shadow-[0_12px_35px_-24px_rgba(15,23,42,.45)] sm:p-6" aria-labelledby="pipeline-title">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-extrabold uppercase tracking-[.14em] text-emerald-600">Pipeline</p>
          <h2 id="pipeline-title" className="mt-1 text-lg font-black text-slate-900">Trạng thái hồ sơ</h2>
          <p className="mt-1 text-xs leading-5 text-slate-500">Phân bổ trên toàn bộ hồ sơ hiện có</p>
        </div>
        <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-700">{interviewRate}% phỏng vấn</span>
      </div>

      <div className="relative mx-auto mt-3 h-48 max-w-[260px]" role="img" aria-label={`Biểu đồ pipeline gồm ${total} hồ sơ`}>
        <ResponsiveContainer width="100%" height="100%" minWidth={0} initialDimension={{ width: 240, height: 192 }}>
          <PieChart>
            <Pie
              data={chartData}
              dataKey="value"
              nameKey="label"
              cx="50%"
              cy="50%"
              innerRadius={58}
              outerRadius={82}
              paddingAngle={data.length > 1 ? 3 : 0}
              cornerRadius={7}
              stroke="none"
              animationDuration={850}
              animationEasing="ease-out"
            >
              {chartData.map((item) => <Cell key={item.key} fill={item.color} />)}
            </Pie>
            <Tooltip content={<PipelineTooltip />} />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <strong className="text-2xl font-black tracking-tight text-slate-900">{numberFormatter.format(total)}</strong>
          <span className="text-[11px] font-semibold text-slate-400">Tổng hồ sơ</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-x-4 gap-y-3">
        {PIPELINE_SEGMENTS.map((item) => (
          <div key={item.key} className="flex min-w-0 items-center gap-2">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: item.color }} />
            <span className="min-w-0 flex-1 truncate text-xs text-slate-500">{item.label}</span>
            <strong className="text-xs text-slate-800">{numberFormatter.format(summary[item.key] || 0)}</strong>
          </div>
        ))}
      </div>

      <Link to={employerAppPath('/applications')} className="mt-5 flex items-center justify-center gap-2 rounded-xl border border-slate-200 !bg-slate-50 px-3 py-2.5 text-xs font-bold !text-slate-700 transition hover:border-emerald-200 hover:!bg-emerald-50 hover:!text-emerald-700">
        Xem toàn bộ hồ sơ <ArrowRightOutlined />
      </Link>
    </section>
  )
}
