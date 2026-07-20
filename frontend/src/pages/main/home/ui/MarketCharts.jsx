import { useState } from 'react'
import { formatNumber as fmt } from '@/entities/job'
import { DEMAND_COLORS, LINE_COLOR } from '../lib/market-stats-palette'

export function GrowthChart({ data, animate }) {
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
      {ticks.map((t, i) => (
        <g key={i}>
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

export function DemandChart({ data, animate }) {
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
        {ticks.map((t, i) => (
          <g key={i}>
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
