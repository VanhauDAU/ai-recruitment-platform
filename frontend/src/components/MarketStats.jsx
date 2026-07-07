import { RiseOutlined, BarChartOutlined } from '@ant-design/icons'
import { Skeleton } from 'antd'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getJobStats } from '../api/jobService'

// Categorical palette validated for the dark-green surface (dataviz skill, CVD ΔE 27.6, contrast ≥3:1)
const DEMAND_COLORS = ['#3987e5', '#c98500', '#e66767', '#9085e9', '#199e70', '#d95926']
const LINE_COLOR = '#3ddc84'
const ROTATE_MS = 10000

const fmt = (n) => (n ?? 0).toLocaleString('vi-VN')

export default function MarketStats() {
  const navigate = useNavigate()
  const [stats, setStats] = useState(null)
  const [start, setStart] = useState(0)

  useEffect(() => {
    getJobStats().then(setStats).catch(() => {})
  }, [])

  const latest = stats?.latest_jobs || []
  useEffect(() => {
    if (latest.length <= 3) return
    const timer = setInterval(() => setStart((s) => (s + 1) % latest.length), ROTATE_MS)
    return () => clearInterval(timer)
  }, [latest.length])

  const today = new Date().toLocaleDateString('vi-VN')
  const visibleJobs = latest.length
    ? Array.from({ length: Math.min(3, latest.length) }, (_, k) => latest[(start + k) % latest.length])
    : []

  return (
    <div className="rounded-xl bg-gradient-to-br from-[#0f3d2e] to-[#0a2a20] text-white p-5 md:p-6 shadow-lg">
      <h2 className="text-lg md:text-xl font-bold mb-5">
        Thị trường việc làm hôm nay <span className="text-[#3ddc84]">{today}</span>
      </h2>

      {!stats ? (
        <Skeleton active paragraph={{ rows: 6 }} className="[&_.ant-skeleton-title]:!bg-white/10 [&_.ant-skeleton-paragraph_li]:!bg-white/10" />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-[260px_1fr] gap-6">
          {/* Left: mascot + latest jobs */}
          <div>
            <Mascot />
            <p className="font-semibold mt-4 mb-3">Việc làm mới nhất</p>
            <ul className="space-y-2.5 min-h-[180px]">
              {visibleJobs.map((job, idx) => (
                <li
                  key={job.public_id}
                  onClick={() => navigate(`/jobs/${job.slug}`)}
                  className={`flex items-center gap-3 rounded-lg bg-white/5 hover:bg-white/10 p-2.5 cursor-pointer transition ${
                    idx === 0 ? 'animate-slide-in' : ''
                  }`}
                >
                  <span
                    className="w-9 h-9 shrink-0 rounded-md flex items-center justify-center text-sm font-bold text-white"
                    style={{ background: DEMAND_COLORS[job.title.length % DEMAND_COLORS.length] }}
                  >
                    {job.company_name.replace(/^(Công ty|CP|TNHH|Tập đoàn|Ngân hàng)\s*/gi, '').trim().charAt(0)}
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{job.title}</p>
                    <p className="text-xs text-green-100/70 truncate">{job.company_name}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          {/* Right: stat tiles + charts */}
          <div className="space-y-5">
            <div className="grid grid-cols-3 gap-3">
              <StatTile value={stats.new_jobs_24h} label="Việc làm mới 24h gần nhất" />
              <StatTile value={stats.active_jobs} label="Việc làm đang tuyển" />
              <StatTile value={stats.companies} label="Công ty đang tuyển" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Panel icon={<RiseOutlined />} title="Tăng trưởng cơ hội việc làm">
                <GrowthChart data={stats.growth} />
              </Panel>
              <Panel icon={<BarChartOutlined />} title="Nhu cầu tuyển dụng theo ngành nghề">
                <DemandChart data={stats.demand} />
              </Panel>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function StatTile({ value, label }) {
  return (
    <div className="rounded-lg bg-white/5 border border-white/10 p-3">
      <p className="text-2xl md:text-3xl font-bold">{fmt(value)}</p>
      <p className="text-xs text-green-100/70 mt-1 leading-tight">{label}</p>
    </div>
  )
}

function Panel({ icon, title, children }) {
  return (
    <div className="rounded-lg bg-white/5 border border-white/10 p-3">
      <p className="text-sm font-medium mb-2 flex items-center gap-1.5">
        <span className="text-[#3ddc84]">{icon}</span> {title}
      </p>
      {children}
    </div>
  )
}

function Mascot() {
  return (
    <div className="flex justify-center">
      <svg viewBox="0 0 120 110" className="w-28 h-auto" role="img" aria-label="Trợ lý ảo">
        <defs>
          <radialGradient id="glow" cx="50%" cy="45%" r="55%">
            <stop offset="0%" stopColor="#3ddc84" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#3ddc84" stopOpacity="0" />
          </radialGradient>
        </defs>
        <ellipse cx="60" cy="55" rx="55" ry="50" fill="url(#glow)" />
        <line x1="60" y1="16" x2="60" y2="26" stroke="#3ddc84" strokeWidth="2" />
        <circle cx="60" cy="13" r="4" fill="#3ddc84" />
        <rect x="30" y="26" width="60" height="48" rx="16" fill="#e8fff4" />
        <rect x="37" y="36" width="46" height="26" rx="12" fill="#0a2a20" />
        <circle cx="50" cy="49" r="5" fill="#3ddc84" />
        <circle cx="70" cy="49" r="5" fill="#3ddc84" />
        <rect x="42" y="74" width="36" height="24" rx="8" fill="#cfeede" />
        <rect x="26" y="78" width="10" height="18" rx="5" fill="#e8fff4" />
        <rect x="84" y="78" width="10" height="18" rx="5" fill="#e8fff4" />
      </svg>
    </div>
  )
}

function GrowthChart({ data }) {
  const W = 300, H = 150, padL = 34, padR = 8, padT = 12, padB = 22
  if (!data?.length) return null
  const counts = data.map((d) => d.count)
  const rawMax = Math.max(...counts)
  const rawMin = Math.min(...counts)
  const span = Math.max(1, rawMax - rawMin)
  const yMax = rawMax + Math.ceil(span * 0.25)
  const yMin = Math.max(0, rawMin - Math.ceil(span * 0.25))
  const x = (i) => padL + (i / (data.length - 1)) * (W - padL - padR)
  const y = (v) => padT + (1 - (v - yMin) / (yMax - yMin || 1)) * (H - padT - padB)
  const line = data.map((d, i) => `${x(i)},${y(d.count)}`).join(' ')
  const area = `${padL},${y(yMin)} ${line} ${x(data.length - 1)},${y(yMin)}`
  const ticks = [yMin, Math.round((yMin + yMax) / 2), yMax]

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto">
      <defs>
        <linearGradient id="growthFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={LINE_COLOR} stopOpacity="0.35" />
          <stop offset="100%" stopColor={LINE_COLOR} stopOpacity="0" />
        </linearGradient>
      </defs>
      {ticks.map((t) => (
        <g key={t}>
          <line x1={padL} y1={y(t)} x2={W - padR} y2={y(t)} stroke="#ffffff" strokeOpacity="0.08" />
          <text x={padL - 5} y={y(t) + 3} textAnchor="end" fontSize="8" fill="#ffffff" fillOpacity="0.55">
            {fmt(t)}
          </text>
        </g>
      ))}
      <polygon points={area} fill="url(#growthFill)" />
      <polyline points={line} fill="none" stroke={LINE_COLOR} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      {data.map((d, i) => (
        <circle key={d.date} cx={x(i)} cy={y(d.count)} r="2.6" fill={LINE_COLOR}>
          <title>{d.date}: {fmt(d.count)} việc làm</title>
        </circle>
      ))}
      {data.map((d, i) => (
        <text key={d.date} x={x(i)} y={H - 6} textAnchor="middle" fontSize="7.5" fill="#ffffff" fillOpacity="0.55">
          {d.date}
        </text>
      ))}
    </svg>
  )
}

function DemandChart({ data }) {
  const W = 300, H = 150, padL = 30, padR = 8, padT = 12, padB = 14
  if (!data?.length) return null
  const max = Math.max(...data.map((d) => d.count))
  const yMax = Math.max(1, Math.ceil(max / 2) * 2)
  const plotW = W - padL - padR
  const plotH = H - padT - padB
  const step = plotW / data.length
  const barW = Math.min(26, step * 0.55)
  const y = (v) => padT + (1 - v / yMax) * plotH
  const ticks = [0, yMax / 2, yMax]

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto">
        {ticks.map((t) => (
          <g key={t}>
            <line x1={padL} y1={y(t)} x2={W - padR} y2={y(t)} stroke="#ffffff" strokeOpacity="0.08" />
            <text x={padL - 5} y={y(t) + 3} textAnchor="end" fontSize="8" fill="#ffffff" fillOpacity="0.55">
              {t}
            </text>
          </g>
        ))}
        {data.map((d, i) => {
          const cx = padL + step * i + step / 2
          const h = (d.count / yMax) * plotH
          return (
            <rect
              key={d.name}
              x={cx - barW / 2}
              y={padT + plotH - h}
              width={barW}
              height={h}
              rx="4"
              fill={DEMAND_COLORS[i % DEMAND_COLORS.length]}
            >
              <title>{d.name}: {fmt(d.count)} việc làm</title>
            </rect>
          )
        })}
      </svg>
      <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2">
        {data.map((d, i) => (
          <span key={d.name} className="flex items-center gap-1 text-[11px] text-green-100/80">
            <span className="w-2 h-2 rounded-sm" style={{ background: DEMAND_COLORS[i % DEMAND_COLORS.length] }} />
            {d.name}
          </span>
        ))}
      </div>
    </div>
  )
}
