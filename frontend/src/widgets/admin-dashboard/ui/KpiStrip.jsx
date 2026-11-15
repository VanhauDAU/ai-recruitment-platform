import { ArrowDownOutlined, ArrowUpOutlined, MinusOutlined } from '@ant-design/icons'
import { ACTIVITY_METRICS, formatNumber, formatPercent, periodChange } from '../model/dashboard-model'

function Sparkline({ values }) {
  const max = Math.max(1, ...values)
  const step = values.length > 1 ? 100 / (values.length - 1) : 100
  const points = values.map((value, index) => `${(index * step).toFixed(2)},${(30 - (value / max) * 28).toFixed(2)}`)
  return (
    <svg className="admin-home-kpi__spark" viewBox="0 0 100 32" preserveAspectRatio="none" aria-hidden="true">
      <polyline points={`0,32 ${points.join(' ')} 100,32`} className="admin-home-kpi__spark-area" />
      <polyline points={points.join(' ')} className="admin-home-kpi__spark-line" />
    </svg>
  )
}

function Change({ comparison, days }) {
  const change = periodChange(comparison)
  if (change === null) return <span className="admin-home-kpi__change">Mới trong kỳ, {days} ngày trước chưa có</span>
  const direction = change > 0 ? 'up' : change < 0 ? 'down' : 'flat'
  const Icon = { up: ArrowUpOutlined, down: ArrowDownOutlined, flat: MinusOutlined }[direction]
  return (
    <span className={`admin-home-kpi__change admin-home-kpi__change--${direction}`}>
      <Icon aria-hidden="true" />
      <strong>{direction === 'flat' ? 'Không đổi' : formatPercent(Math.abs(change))}</strong>
      <span> so với {days} ngày trước ({formatNumber(comparison.previous)})</span>
    </span>
  )
}

export default function KpiStrip({ kpis, activity, days }) {
  return (
    <section className="admin-home-kpis" aria-label={`Chỉ số ${days} ngày qua`}>
      {ACTIVITY_METRICS.map((metric) => (
        <article key={metric.key} className="admin-home-kpi">
          <p className="admin-home-kpi__label">{metric.label}</p>
          <p className="admin-home-kpi__value">{formatNumber(kpis[metric.key]?.current)}</p>
          <Change comparison={kpis[metric.key] || {}} days={days} />
          <Sparkline values={activity.map((item) => Number(item[metric.key] || 0))} />
        </article>
      ))}
    </section>
  )
}
