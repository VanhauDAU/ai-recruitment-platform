import {
  AuditOutlined,
  BankOutlined,
  BuildOutlined,
  CalculatorOutlined,
  CodeOutlined,
  CustomerServiceOutlined,
  DollarCircleOutlined,
  HomeOutlined,
  LaptopOutlined,
  MedicineBoxOutlined,
  NotificationOutlined,
  ReadOutlined,
  ShopOutlined,
  SolutionOutlined,
  TeamOutlined,
} from '@ant-design/icons'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getJobStats } from '../../api/jobService'
import { companyInitial, formatNumber } from '../../constants/jobOptions'
import ArrowButton from '../ui/ArrowButton'

const ICONS = {
  accounting: CalculatorOutlined,
  admin: SolutionOutlined,
  audit: AuditOutlined,
  bank: BankOutlined,
  business: ShopOutlined,
  construction: BuildOutlined,
  education: ReadOutlined,
  finance: DollarCircleOutlined,
  health: MedicineBoxOutlined,
  hr: TeamOutlined,
  it: LaptopOutlined,
  marketing: NotificationOutlined,
  real_estate: HomeOutlined,
  sales: ShopOutlined,
  software: CodeOutlined,
  support: CustomerServiceOutlined,
}

const FALLBACK_ICON_RULES = [
  [/kinh doanh|bán hàng|sales/i, 'sales'],
  [/marketing|quảng cáo|pr/i, 'marketing'],
  [/chăm sóc|customer|support/i, 'support'],
  [/nhân sự|hành chính|hr/i, 'hr'],
  [/công nghệ|it|phần mềm|lập trình/i, 'it'],
  [/tài chính|ngân hàng|bank/i, 'bank'],
  [/bất động sản/i, 'real_estate'],
  [/kế toán|kiểm toán|thuế/i, 'accounting'],
  [/xây dựng|sản xuất/i, 'construction'],
  [/giáo dục|đào tạo/i, 'education'],
]

const LOGO_SIZES = ['h-16 w-16', 'h-24 w-24', 'h-20 w-20', 'h-28 w-28', 'h-[72px] w-[72px]']
const CARD_LOGO_COLORS = [
  'bg-emerald-50 text-[#00b14f]',
  'bg-blue-50 text-blue-600',
  'bg-amber-50 text-amber-600',
  'bg-rose-50 text-rose-600',
  'bg-violet-50 text-violet-600',
]

function iconKeyFor(category) {
  const key = category.icon_key?.trim()
  if (key && ICONS[key]) return key
  const match = FALLBACK_ICON_RULES.find(([pattern]) => pattern.test(category.name || ''))
  return match?.[1] || 'business'
}

function EmployerLogo({ employer, index, floating = false }) {
  const color = CARD_LOGO_COLORS[index % CARD_LOGO_COLORS.length]
  const size = floating ? LOGO_SIZES[index % LOGO_SIZES.length] : 'h-20 w-28'

  return (
    <div
      className={`${size} flex shrink-0 items-center justify-center rounded-2xl border border-gray-200 bg-white p-3 shadow-sm ${
        floating ? 'rounded-full shadow-md' : ''
      }`}
    >
      {employer.company_logo_url ? (
        <img
          src={employer.company_logo_url}
          alt={employer.company_name}
          className="max-h-full max-w-full object-contain"
          loading="lazy"
        />
      ) : (
        <span className={`flex h-full w-full items-center justify-center rounded-xl text-xl font-extrabold ${color}`}>
          {companyInitial(employer.company_name)}
        </span>
      )}
    </div>
  )
}

// Random-but-stable sizing and vertical positioning for each employer slot.
// We seed by index so the layout is deterministic across renders.
const BUBBLE_SIZES = [48, 56, 64, 72, 80, 88, 96]      // px
const BELT_HEIGHT  = 120                                  // px — container height
const BUBBLE_GAP   = 28                                   // px — gap between bubbles

function seededRand(seed) {
  // Simple deterministic pseudo-random: xorshift
  let x = (seed * 1664525 + 1013904223) & 0xffffffff
  return ((x >>> 0) / 0xffffffff)
}

function FloatingBubbleBelt({ employers, navigate }) {
  if (!employers.length) return null

  // Build one strip; we'll duplicate it for seamless loop
  const strip = [...employers, ...employers, ...employers, ...employers]

  // Pre-calculate per-item size + top offset (stable across renders)
  const items = strip.map((employer, i) => {
    const idx = i % employers.length
    const size = BUBBLE_SIZES[idx % BUBBLE_SIZES.length]
    // vertical: keep circle fully inside belt height
    const topMax = BELT_HEIGHT - size
    const top = Math.round(seededRand(idx * 7 + 3) * topMax)
    return { employer, size, top }
  })

  return (
    <div
      className="relative mt-10 overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_8%,black_92%,transparent)]"
      style={{ height: BELT_HEIGHT + 16 }}
    >
      <style>{`
        @keyframes bubbleScroll {
          from { transform: translateX(0); }
          to   { transform: translateX(-50%); }
        }
        .bubble-belt {
          animation: bubbleScroll ${Math.max(employers.length * 2.8, 18)}s linear infinite;
          animation-play-state: running !important;
          will-change: transform;
        }
        .bubble-belt * { pointer-events: auto; }
      `}</style>

      <div
        className="bubble-belt absolute top-0 left-0 flex"
        style={{ gap: BUBBLE_GAP }}
      >
        {items.map(({ employer, size, top }, i) => {
          const color = CARD_LOGO_COLORS[i % CARD_LOGO_COLORS.length]
          return (
            <button
              key={`${employer.public_id}-${i}`}
              type="button"
              onClick={() =>
                navigate(
                  `/jobs?search=${encodeURIComponent(employer.company_name)}&search_by=company`,
                )
              }
              title={employer.company_name}
              className="shrink-0 cursor-pointer rounded-full border border-gray-100 bg-white shadow-md transition-shadow hover:shadow-lg"
              style={{
                width:  size,
                height: size,
                marginTop: top,
                flexShrink: 0,
              }}
            >
              {employer.company_logo_url ? (
                <img
                  src={employer.company_logo_url}
                  alt={employer.company_name}
                  className="h-full w-full rounded-full object-contain p-2"
                  loading="lazy"
                  draggable={false}
                />
              ) : (
                <span
                  className={`flex h-full w-full items-center justify-center rounded-full text-lg font-extrabold ${color}`}
                >
                  {companyInitial(employer.company_name)}
                </span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}

export default function FeaturedIndustriesEmployers() {
  const navigate = useNavigate()
  const [stats, setStats] = useState(null)

  useEffect(() => {
    getJobStats().then(setStats).catch(() => {})
  }, [])

  const industries = useMemo(() => (stats?.demand || []).slice(0, 8), [stats])
  const employers = useMemo(() => stats?.featured_employers || [], [stats])

  if (!stats || (industries.length === 0 && employers.length === 0)) return null

  return (
    <section className="bg-white py-10">
      <div className="mx-auto max-w-6xl px-4">
        {industries.length > 0 && (
          <div>
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-xl font-extrabold text-[#00b14f]">Top ngành nghề nổi bật</h2>
              <div className="hidden items-center gap-2 sm:flex">
                <ArrowButton dir="left" disabled />
                <ArrowButton dir="right" onClick={() => navigate('/jobs')} />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {industries.map((category) => {
                const key = iconKeyFor(category)
                const Icon = ICONS[key] || ShopOutlined
                const color = category.icon_color || '#00b14f'
                return (
                  <button
                    key={category.id}
                    type="button"
                    onClick={() => navigate(`/jobs?category=${category.id}`)}
                    className="group flex min-h-[156px] cursor-pointer flex-col items-center justify-center rounded-lg bg-gray-100 px-5 py-6 text-center transition hover:-translate-y-1 hover:bg-green-50 hover:shadow-md"
                  >
                    <span
                      className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-4xl shadow-sm transition group-hover:scale-105"
                      style={{ color }}
                    >
                      <Icon />
                    </span>
                    <span className="line-clamp-1 text-sm font-bold text-gray-800">{category.name}</span>
                    <span className="mt-2 text-xs font-medium text-[#00b14f]">
                      {formatNumber(category.count)} việc làm
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {employers.length > 0 && (
          <div className="mt-8">
            <h2 className="mb-5 text-xl font-extrabold text-[#00b14f]">Nhà tuyển dụng nổi bật</h2>

            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
              {employers.slice(0, 5).map((employer, index) => (
                <button
                  key={employer.public_id}
                  type="button"
                  onClick={() => navigate(`/jobs?search=${encodeURIComponent(employer.company_name)}&search_by=company`)}
                  className="relative flex h-36 cursor-pointer items-center justify-center rounded-lg border border-gray-200 bg-white p-4 transition hover:-translate-y-1 hover:border-[#00b14f] hover:shadow-md"
                >
                  <span className="absolute left-3 top-3 rounded-full bg-[#00b14f] px-2 py-0.5 text-[10px] font-bold text-white">
                    TOP
                  </span>
                  <EmployerLogo employer={employer} index={index} />
                </button>
              ))}
            </div>

            <FloatingBubbleBelt employers={employers} navigate={navigate} />
          </div>
        )}
      </div>
    </section>
  )
}
