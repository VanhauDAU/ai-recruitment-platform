import { ArrowUpOutlined, BarChartOutlined, RiseOutlined } from '@ant-design/icons'
import { Select, Skeleton, Tooltip } from 'antd'
import { useEffect, useMemo, useRef, useState } from 'react'
import { getJobStats } from '../../../../api/jobService'
import {
  EMPLOYMENT_TYPE_LABELS,
  EXPERIENCE_LEVEL_LABELS,
  WORK_TYPE_LABELS,
  companyInitial,
  formatNumber as fmt,
  formatSalary,
} from '../../../../constants/jobOptions'
import { useCountUp } from '../../../../hooks/useCountUp'

// Categorical palette validated for the dark-green surface (dataviz skill, CVD ΔE 27.6, contrast ≥3:1)
const DEMAND_COLORS = ['#3987e5', '#c98500', '#e66767', '#9085e9', '#199e70', '#d95926']
const LINE_COLOR = '#3ddc84'
const ROTATE_MS = 10000
const FEED_SIZE = 3
const FEED_EXIT_MS = 420

function useInViewOnce(threshold = 0.25) {
  const ref = useRef(null)
  const [inView, setInView] = useState(false)

  useEffect(() => {
    const node = ref.current
    if (!node || inView) return undefined
    if (!('IntersectionObserver' in window)) {
      setInView(true)
      return undefined
    }
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setInView(true)
        observer.disconnect()
      }
    }, { threshold })
    observer.observe(node)
    return () => observer.disconnect()
  }, [inView, threshold])

  return [ref, inView]
}

// Feeds `jobs` in one at a time at the top, pushing existing entries down;
// the entry pushed past FEED_SIZE plays an exit animation before being dropped.
function useLatestJobsFeed(jobs, enabled) {
  const [feed, setFeed] = useState([])
  const indexRef = useRef(0)
  const timeoutRef = useRef(null)

  useEffect(() => {
    if (!enabled || !jobs.length) {
      setFeed((prev) => (prev.length ? [] : prev))
      return undefined
    }
    const seedCount = Math.min(FEED_SIZE, jobs.length)
    indexRef.current = seedCount
    setFeed(jobs.slice(0, seedCount).map((job, i) => ({ uid: `${job.public_id}-seed-${i}`, job })))

    if (jobs.length <= FEED_SIZE) return undefined

    const timer = setInterval(() => {
      const job = jobs[indexRef.current % jobs.length]
      const uid = `${job.public_id}-${indexRef.current}`
      indexRef.current += 1
      setFeed((prev) => [
        { uid, job },
        ...prev.map((item, i) => (i === prev.length - 1 ? { ...item, exiting: true } : item)),
      ])
      clearTimeout(timeoutRef.current)
      timeoutRef.current = setTimeout(() => {
        setFeed((prev) => prev.filter((item) => !item.exiting))
      }, FEED_EXIT_MS)
    }, ROTATE_MS)

    return () => {
      clearInterval(timer)
      clearTimeout(timeoutRef.current)
    }
  }, [jobs, enabled])

  return feed
}

export default function MarketStats() {
  const [sectionRef, hasEnteredView] = useInViewOnce()
  const [stats, setStats] = useState(null)
  const [demandType, setDemandType] = useState('category')
  const [chartAnimKey, setChartAnimKey] = useState(0)

  useEffect(() => {
    getJobStats().then(setStats).catch(() => {})
  }, [])

  const latest = useMemo(() => stats?.latest_jobs || [], [stats])
  const feed = useLatestJobsFeed(latest, hasEnteredView)

  const today = new Date().toLocaleDateString('vi-VN')
  const demandData = useMemo(
    () => (demandType === 'salary' ? stats?.salary_demand || [] : stats?.demand || []),
    [demandType, stats],
  )
  const demandTitle = demandType === 'salary' ? 'Nhu cầu tuyển dụng theo mức lương' : 'Nhu cầu tuyển dụng theo ngành nghề'

  function changeDemandType(value) {
    setDemandType(value)
    setChartAnimKey((key) => key + 1)
  }

  return (
    <div ref={sectionRef} className="rounded-xl bg-gradient-to-br from-[#0f3d2e] to-[#0a2a20] text-white p-5 md:p-6 shadow-lg">
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
              {feed.map((item, idx) => (
                <Tooltip
                  key={item.uid}
                  placement="right"
                  title={item.exiting ? null : <LatestJobTooltip job={item.job} />}
                  styles={{ inner: { width: 300 } }}
                >
                  <li
                    onClick={() => !item.exiting && window.open(`/viec-lam/${item.job.slug}`, '_blank', 'noopener,noreferrer')}
                    className={`relative flex items-center gap-3 rounded-lg bg-white/5 hover:bg-white/10 p-2.5 cursor-pointer transition ${
                      item.exiting
                        ? 'animate-job-exit pointer-events-none'
                        : idx === 0
                          ? 'animate-job-pop pl-9 ring-1 ring-[#3ddc84]/35'
                          : 'animate-job-push'
                    }`}
                  >
                    {idx === 0 && !item.exiting && (
                      <span className="absolute left-2 top-1/2 -translate-y-1/2 inline-flex h-5 w-5 items-center justify-center rounded-full bg-[#3ddc84] text-[#07351f] shadow-sm">
                        <ArrowUpOutlined className="text-[10px]" />
                      </span>
                    )}
                    <span
                      className="w-9 h-9 shrink-0 rounded-md flex items-center justify-center text-sm font-bold text-white"
                      style={{ background: DEMAND_COLORS[item.job.title.length % DEMAND_COLORS.length] }}
                    >
                      {companyInitial(item.job.company_name)}
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{item.job.title}</p>
                      <p className="text-xs text-green-100/70 truncate">{item.job.company_name}</p>
                    </div>
                  </li>
                </Tooltip>
              ))}
            </ul>
          </div>

          {/* Right: stat tiles + charts */}
          <div className="space-y-5">
            <div className="grid grid-cols-3 gap-3">
              <StatTile value={stats.new_jobs_24h} label="Việc làm mới 24h gần nhất" animate={hasEnteredView} />
              <StatTile value={stats.active_jobs} label="Việc làm đang tuyển" animate={hasEnteredView} />
              <StatTile value={stats.companies} label="Công ty đang tuyển" animate={hasEnteredView} />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Panel icon={<RiseOutlined />} title="Tăng trưởng cơ hội việc làm 7 ngày">
                <GrowthChart data={stats.growth} animate={hasEnteredView} />
              </Panel>
              <Panel
                icon={<BarChartOutlined />}
                title={demandTitle}
                action={
                  <Select
                    size="small"
                    value={demandType}
                    onChange={changeDemandType}
                    options={[
                      { value: 'category', label: 'Ngành nghề' },
                      { value: 'salary', label: 'Mức lương' },
                    ]}
                    className="min-w-[116px] [&_.ant-select-selector]:!bg-white/10 [&_.ant-select-selector]:!border-white/20 [&_.ant-select-selection-item]:!text-white [&_.ant-select-arrow]:!text-white/70"
                  />
                }
              >
                <DemandChart key={`${chartAnimKey}-${hasEnteredView}`} data={demandData} animate={hasEnteredView} />
              </Panel>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function StatTile({ value, label, animate }) {
  const display = useCountUp(value, { enabled: animate })
  return (
    <div className="rounded-lg bg-white/5 border border-white/10 p-3">
      <p className="text-2xl md:text-3xl font-bold tabular-nums">{fmt(display)}</p>
      <p className="text-xs text-green-100/70 mt-1 leading-tight">{label}</p>
    </div>
  )
}

function Panel({ icon, title, action, children }) {
  return (
    <div className="rounded-lg bg-white/5 border border-white/10 p-3">
      <div className="mb-2 flex items-center gap-2">
        <p className="min-w-0 flex-1 text-sm font-medium flex items-center gap-1.5">
          <span className="text-[#3ddc84]">{icon}</span>
          <span className="truncate">{title}</span>
        </p>
        {action}
      </div>
      {children}
    </div>
  )
}

function LatestJobTooltip({ job }) {
  const locations = job.location_names?.length ? job.location_names.join(' · ') : job.location_name || 'Chưa cập nhật'
  const details = [
    ['Lương', formatSalary(job)],
    ['Địa điểm', locations],
    ['Kinh nghiệm', EXPERIENCE_LEVEL_LABELS[job.experience_level] || 'Không yêu cầu'],
    ['Hình thức', WORK_TYPE_LABELS[job.work_type] || 'Chưa cập nhật'],
    ['Loại việc', EMPLOYMENT_TYPE_LABELS[job.employment_type] || 'Chưa cập nhật'],
    ['Số lượng', job.number_of_vacancies ? `${fmt(job.number_of_vacancies)} vị trí` : 'Không giới hạn'],
    ['Hạn nộp', formatDate(job.deadline) || 'Chưa cập nhật'],
  ]

  return (
    <div className="text-xs leading-relaxed">
      <p className="text-sm font-semibold leading-snug">{job.title}</p>
      <p className="mt-0.5 text-green-100/80">{job.company_name}</p>
      {job.short_description && <p className="mt-2 line-clamp-2 text-white/80">{job.short_description}</p>}
      <div className="mt-2 grid grid-cols-[72px_1fr] gap-x-2 gap-y-1">
        {details.map(([label, value]) => (
          <div key={label} className="contents">
            <span className="text-green-100/65">{label}</span>
            <span className="min-w-0 text-white">{value}</span>
          </div>
        ))}
      </div>
      <p className="mt-2 text-green-100/65">Đăng: {formatDateTime(job.published_at) || 'Chưa cập nhật'}</p>
    </div>
  )
}

function formatDate(value) {
  if (!value) return null
  return new Intl.DateTimeFormat('vi-VN').format(new Date(value))
}

function formatDateTime(value) {
  if (!value) return null
  return new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(value))
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

function GrowthChart({ data, animate }) {
  const [hovered, setHovered] = useState(null)
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
    <div className={`relative ${animate ? 'animate-chart-rise' : ''}`}>
      {hovered && (
        <div
          className="pointer-events-none absolute z-10 rounded-md border border-white/10 bg-[#062117] px-2 py-1 text-xs text-white shadow-lg"
          style={{ left: `${(hovered.x / W) * 100}%`, top: `${(hovered.y / H) * 100}%`, transform: 'translate(-50%, -115%)' }}
        >
          <p className="font-semibold">{hovered.date}</p>
          <p className="text-green-100/80">{fmt(hovered.count)} việc làm</p>
        </div>
      )}
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
      <polygon points={area} fill="url(#growthFill)" className={animate ? 'animate-chart-area' : ''} />
      <polyline
        points={line}
        fill="none"
        stroke={LINE_COLOR}
        strokeWidth="2"
        strokeLinejoin="round"
        strokeLinecap="round"
        pathLength="1"
        className={animate ? 'animate-chart-line' : ''}
      />
      {data.map((d, i) => (
        <g
          key={d.date}
          onMouseEnter={() => setHovered({ ...d, x: x(i), y: y(d.count) })}
          onMouseLeave={() => setHovered(null)}
          className={`cursor-pointer ${animate ? 'animate-chart-dot' : ''}`}
          style={{ animationDelay: `${180 + i * 70}ms` }}
        >
          <circle cx={x(i)} cy={y(d.count)} r="8" fill="transparent" />
          <circle cx={x(i)} cy={y(d.count)} r={hovered?.date === d.date ? 4 : 2.8} fill={LINE_COLOR} stroke="#ffffff" strokeOpacity="0.75" />
        </g>
      ))}
      {data.map((d, i) => (
        <text key={d.date} x={x(i)} y={H - 6} textAnchor="middle" fontSize="7.5" fill="#ffffff" fillOpacity="0.55">
          {d.date}
        </text>
      ))}
      </svg>
    </div>
  )
}

function DemandChart({ data, animate }) {
  const [hovered, setHovered] = useState(null)
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
    <div className={`relative ${animate ? 'animate-chart-rise' : ''}`}>
      {hovered && (
        <div
          className="pointer-events-none absolute z-10 max-w-[160px] rounded-md border border-white/10 bg-[#062117] px-2 py-1 text-xs text-white shadow-lg"
          style={{ left: `${(hovered.x / W) * 100}%`, top: `${(hovered.y / H) * 100}%`, transform: 'translate(-50%, -115%)' }}
        >
          <p className="font-semibold truncate">{hovered.name}</p>
          <p className="text-green-100/80">{fmt(hovered.count)} việc làm</p>
        </div>
      )}
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
          const top = padT + plotH - h
          return (
            <rect
              key={d.name}
              x={cx - barW / 2}
              y={top}
              width={barW}
              height={h}
              rx="4"
              fill={DEMAND_COLORS[i % DEMAND_COLORS.length]}
              className={`cursor-pointer transition-opacity hover:opacity-90 ${animate ? 'animate-bar-grow' : ''}`}
              style={{
                animationDelay: `${i * 80}ms`,
                transformBox: 'fill-box',
                transformOrigin: 'center bottom',
              }}
              onMouseEnter={() => setHovered({ ...d, x: cx, y: top })}
              onMouseLeave={() => setHovered(null)}
            />
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
