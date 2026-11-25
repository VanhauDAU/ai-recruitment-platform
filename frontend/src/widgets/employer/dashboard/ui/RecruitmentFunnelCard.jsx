import { ArrowRightOutlined } from '@ant-design/icons'
import { Link } from 'react-router'
import { employerAppPath } from '@/shared/config/portals'
import { getIntlLocale, m } from '@/shared/config/i18n'

// Each stage: [edge, highlight, rim] shades of one hue for the 3D look.
const STAGES = [
  { key: 'received', label: m.employer_workspace_dash_funnel_received(), shades: ['#6b778a', '#c3cbd7', '#d5dbe4'] },
  { key: 'shortlisted', label: m.employer_workspace_dash_funnel_shortlisted(), shades: ['#c98a12', '#fbd166', '#fde08f'] },
  { key: 'interviewed', label: m.employer_workspace_dash_funnel_interviewed(), shades: ['#3c6bd6', '#93b4fb', '#b4cbfd'] },
  { key: 'accepted', label: m.employer_workspace_dash_funnel_accepted(), shades: ['#1a9e6c', '#64dcad', '#94e9c7'] },
  { key: 'rejected', label: m.employer_workspace_dash_funnel_rejected(), shades: ['#d4475a', '#f8a3ab', '#fbc0c5'] },
]

// SVG geometry (viewBox units). Labels sit left of the funnel, so it is off-center.
const WIDTH = 540
const CENTER_X = 330
const LAYER_HEIGHT = 66
const LAYER_STEP = 78
const TOP_HALF_WIDTH = 185
const TAPER = 27 // narrowing within one layer
const RIM_OVERHANG = 6 // the next layer's rim shows past the layer above
const TILT = 0.09 // ellipse ry / rx: how far we look down into the funnel

const layers = STAGES.map((stage, index) => {
  const top = TOP_HALF_WIDTH - index * (TAPER - RIM_OVERHANG)
  const bottom = top - TAPER
  const y = 18 + index * LAYER_STEP
  return { ...stage, top, bottom, y, bottomY: y + LAYER_HEIGHT }
})
const last = layers[layers.length - 1]
const HEIGHT = Math.ceil(last.bottomY + last.bottom * TILT + 16)

const numberFormatter = new Intl.NumberFormat(getIntlLocale())
const percentFormatter = new Intl.NumberFormat(getIntlLocale(), { style: 'percent', maximumFractionDigits: 1 })
const pct = (value, axis) => `${(value / axis) * 100}%`

function bodyPath({ top, bottom, y, bottomY }) {
  const left = CENTER_X - top
  const right = CENTER_X + top
  return `M${left} ${y}L${CENTER_X - bottom} ${bottomY}`
    + `A${bottom} ${bottom * TILT} 0 0 0 ${CENTER_X + bottom} ${bottomY}`
    + `L${right} ${y}A${top} ${top * TILT} 0 0 1 ${left} ${y}Z`
}

export default function RecruitmentFunnelCard({ funnel = {} }) {
  const received = Number(funnel.received || 0)
  const counts = Object.fromEntries(STAGES.map(({ key }) => [key, Number(funnel[key] || 0)]))
  const chartLabel = STAGES.map(({ key, label }) => `${label}: ${numberFormatter.format(counts[key])}`).join(', ')

  return (
    <section className="flex flex-col rounded-[20px] border border-slate-200/80 bg-white p-5 shadow-[0_12px_35px_-24px_rgba(15,23,42,.45)] sm:p-6" aria-labelledby="funnel-title">
      <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-4">
        <div>
          <h2 id="funnel-title" className="text-lg font-black text-slate-900">{m.employer_workspace_dash_funnel_title()}</h2>
          <p className="mt-1 text-xs leading-5 text-slate-500">{m.employer_workspace_dash_funnel_description()}</p>
        </div>
        <Link to={employerAppPath('/applications')} className="flex shrink-0 items-center gap-1 text-xs font-bold employer-dash-text">
          {m.employer_workspace_dash_view_all()} <ArrowRightOutlined />
        </Link>
      </div>

      <div className="employer-funnel" role="img" aria-label={`${m.employer_workspace_dash_funnel_title()}: ${chartLabel}`}>
        <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} aria-hidden="true">
          <defs>
            <filter id="funnel-shadow" x="-20%" y="-20%" width="140%" height="150%">
              <feDropShadow dx="0" dy="6" stdDeviation="6" floodColor="#0f172a" floodOpacity="0.18" />
            </filter>
            <filter id="funnel-text-shadow">
              <feDropShadow dx="0" dy="1" stdDeviation="1.2" floodColor="#0f172a" floodOpacity="0.35" />
            </filter>
            {layers.map(({ key, shades: [edge, light, rim] }) => (
              <g key={key}>
                <linearGradient id={`funnel-body-${key}`} x1="0" x2="1" y1="0" y2="0">
                  <stop offset="0" stopColor={edge} />
                  <stop offset="0.42" stopColor={light} />
                  <stop offset="0.58" stopColor={light} />
                  <stop offset="1" stopColor={edge} />
                </linearGradient>
                <radialGradient id={`funnel-rim-${key}`} cx="0.5" cy="0.35" r="0.65">
                  <stop offset="0" stopColor="#fff" stopOpacity="0.9" />
                  <stop offset="0.55" stopColor={rim} />
                  <stop offset="1" stopColor={edge} />
                </radialGradient>
              </g>
            ))}
          </defs>
          {/* Drawn bottom-up so each layer's front edge overlaps the rim below it. */}
          <g filter="url(#funnel-shadow)">
            {[...layers].reverse().map((layer) => (
              <g key={layer.key} className="employer-funnel-layer" style={{ '--funnel-index': STAGES.indexOf(layer) }}>
                <title>{`${layer.label}: ${numberFormatter.format(counts[layer.key])}`}</title>
                <ellipse cx={CENTER_X} cy={layer.y} rx={layer.top} ry={layer.top * TILT} fill={`url(#funnel-rim-${layer.key})`} />
                <path d={bodyPath(layer)} fill={`url(#funnel-body-${layer.key})`} />
                <text
                  x={CENTER_X}
                  y={layer.y + LAYER_HEIGHT / 2 + 8}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  className="employer-funnel-count"
                  filter="url(#funnel-text-shadow)"
                >
                  {numberFormatter.format(counts[layer.key])}
                </text>
              </g>
            ))}
          </g>
        </svg>
        {layers.map(({ key, label, top, bottom, y }, index) => (
          <span
            key={key}
            className="employer-funnel-label"
            style={{ top: pct(y + LAYER_HEIGHT / 2 + 8, HEIGHT), right: pct(WIDTH - (CENTER_X - (top + bottom) / 2 - 14), WIDTH) }}
          >
            {label}
            {index > 0 && received > 0 && <small>{percentFormatter.format(counts[key] / received)}</small>}
          </span>
        ))}
      </div>
    </section>
  )
}
