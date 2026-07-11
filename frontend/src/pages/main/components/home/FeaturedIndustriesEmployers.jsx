import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getJobStats } from '@/api/jobService'
import { formatNumber } from '@/constants/jobOptions'
import ArrowButton from '@/components/ui/ArrowButton'

function logoUrlFor(employer) {
  return employer.company_logo_url?.trim() || ''
}

function categoryLogoUrlFor(category) {
  return category.logo_url?.trim() || ''
}

const BUBBLE_LAYOUT = [
  { size: 132, top: 0 },
  { size: 82, top: 128 },
  { size: 98, top: 68 },
  { size: 108, top: 38 },
  { size: 140, top: 8 },
  { size: 86, top: 116 },
  { size: 114, top: 144 },
  { size: 70, top: 22 },
  { size: 118, top: 0 },
  { size: 94, top: 132 },
  { size: 80, top: 74 },
  { size: 110, top: 66 },
  { size: 148, top: 4 },
  { size: 76, top: 128 },
  { size: 126, top: 86 },
  { size: 88, top: 16 },
  { size: 90, top: 16 },
  { size: 106, top: 132 },
  { size: 72, top: 58 },
  { size: 136, top: 24 },
  { size: 82, top: 138 },
  { size: 120, top: 6 },
  { size: 96, top: 104 },
  { size: 68, top: 150 },
  { size: 112, top: 40 },
]
const BELT_HEIGHT = 246
const BUBBLE_GAP = 34
const MARQUEE_REPEATS_PER_HALF = 12
const INDUSTRIES_PER_PAGE = 8
const EMPLOYERS_PER_PAGE = 5

function chunkItems(items, size) {
  return Array.from({ length: Math.ceil(items.length / size) }, (_, i) => items.slice(i * size, i * size + size))
}

function usePagedDrag(totalPages) {
  const [page, setPage] = useState(0)
  const [dragOffset, setDragOffset] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const dragState = useRef({ active: false, startX: 0, width: 0, dragged: false, suppressClickUntil: 0 })
  const lastPage = Math.max(0, totalPages - 1)

  useEffect(() => {
    setPage((p) => Math.min(p, lastPage))
  }, [lastPage])

  function go(delta) {
    setPage((p) => Math.min(Math.max(p + delta, 0), lastPage))
  }

  function startDrag(e) {
    if (totalPages <= 1 || (e.button != null && e.button !== 0)) return
    dragState.current = {
      ...dragState.current,
      active: true,
      startX: e.clientX,
      width: e.currentTarget.clientWidth,
      dragged: false,
    }
    setIsDragging(true)
    e.currentTarget.setPointerCapture?.(e.pointerId)
  }

  function moveDrag(e) {
    if (!dragState.current.active) return
    const delta = e.clientX - dragState.current.startX
    if (Math.abs(delta) > 5) dragState.current.dragged = true
    const limit = Math.max(80, dragState.current.width * 0.35)
    setDragOffset(Math.min(Math.max(delta, -limit), limit))
  }

  function endDrag(e) {
    if (!dragState.current.active) return
    const delta = e.clientX - dragState.current.startX
    const threshold = Math.min(120, Math.max(56, dragState.current.width * 0.16))
    const dragged = dragState.current.dragged
    if (delta <= -threshold) go(1)
    if (delta >= threshold) go(-1)
    dragState.current = {
      ...dragState.current,
      active: false,
      dragged: false,
      suppressClickUntil: dragged ? Date.now() + 160 : 0,
    }
    setDragOffset(0)
    setIsDragging(false)
  }

  function cancelDrag() {
    if (!dragState.current.active) return
    dragState.current = { ...dragState.current, active: false, dragged: false }
    setDragOffset(0)
    setIsDragging(false)
  }

  function suppressClickAfterDrag(e) {
    if (Date.now() >= dragState.current.suppressClickUntil) return
    e.preventDefault()
    e.stopPropagation()
  }

  return {
    page,
    dragOffset,
    isDragging,
    canPrev: page > 0,
    canNext: page < lastPage,
    goPrev: () => go(-1),
    goNext: () => go(1),
    dragHandlers: {
      onPointerDown: startDrag,
      onPointerMove: moveDrag,
      onPointerUp: endDrag,
      onPointerCancel: cancelDrag,
      onClickCapture: suppressClickAfterDrag,
    },
  }
}

function PagedTrack({ groups, page, dragOffset, isDragging, children }) {
  return (
    <div
      className="overflow-hidden px-px pb-2 pt-1"
      style={{ touchAction: 'pan-y' }}
    >
      <div
        className="flex"
        style={{
          transform: `translateX(calc(${-page * 100}% + ${dragOffset}px))`,
          transition: isDragging ? 'none' : 'transform 320ms ease',
        }}
      >
        {groups.map((group, index) => (
          <div key={index} className="min-w-full">
            {children(group)}
          </div>
        ))}
      </div>
    </div>
  )
}

function seededRand(seed) {
  // Simple deterministic pseudo-random: xorshift
  let x = (seed * 1664525 + 1013904223) & 0xffffffff
  return ((x >>> 0) / 0xffffffff)
}

function FloatingBubbleBelt({ employers, navigate }) {
  if (!employers.length) return null

  const halfStrip = Array.from({ length: MARQUEE_REPEATS_PER_HALF }, (_, repeatIndex) =>
    employers.map((employer, employerIndex) => {
      const slot = repeatIndex * employers.length + employerIndex
      const layout = BUBBLE_LAYOUT[slot % BUBBLE_LAYOUT.length]
      const size = layout.size
      const topMax = Math.max(BELT_HEIGHT - size - 8, 0)
      const jitter = (seededRand((employerIndex + 1) * 41 + repeatIndex * 17) - 0.5) * 10
      const top = Math.round(Math.min(Math.max(layout.top + jitter, 0), topMax))
      return { employer, size, top, slot }
    }),
  ).flat()

  const estimatedStripWidth = halfStrip.reduce((sum, item) => sum + item.size + BUBBLE_GAP, 0)
  const duration = Math.min(Math.max(estimatedStripWidth / 52, 88), 180)

  function handleEmployerClick(companyName) {
    navigate(`/viec-lam?search=${encodeURIComponent(companyName)}&search_by=company`)
  }

  const renderBubble = ({ employer, size, top, slot }, i) => {
    const imagePadding = Math.max(9, Math.round(size * 0.18))
    const floatDistance = 3 + (slot % 4) * 1.5
    const floatDuration = 4.8 + (slot % 5) * 0.6
    return (
      <button
        key={`${employer.public_id || employer.company_name}-${i}`}
        type="button"
        onClick={() => handleEmployerClick(employer.company_name)}
        title={employer.company_name}
        className="employer-logo-float shrink-0 cursor-pointer rounded-full border border-gray-100 bg-white shadow-[0_5px_18px_rgba(15,23,42,0.08)] ring-1 ring-gray-100/80 transition-shadow duration-200 hover:shadow-[0_12px_30px_rgba(15,23,42,0.16)]"
        style={{
          width: size,
          height: size,
          marginTop: top,
          flexShrink: 0,
          '--float-distance': `${floatDistance}px`,
          animationDelay: `-${(slot % 9) * 0.38}s`,
          animationDuration: `${floatDuration}s`,
        }}
      >
        <img
          src={logoUrlFor(employer)}
          alt={employer.company_name}
          className="h-full w-full rounded-full object-contain"
          style={{ padding: imagePadding }}
          loading="lazy"
          draggable={false}
        />
      </button>
    )
  }

  return (
    <div
      className="relative left-1/2 mt-14 w-screen -translate-x-1/2 overflow-hidden bg-white"
      style={{ height: BELT_HEIGHT }}
    >
      <style>{`
        @keyframes employerLogoFullBleedMarquee {
          from { transform: translateX(0); }
          to   { transform: translateX(-50%); }
        }
        @keyframes employerLogoFloat {
          0%, 100% { transform: translateY(calc(var(--float-distance) * -1)); }
          50% { transform: translateY(var(--float-distance)); }
        }
        .employer-logo-full-bleed-marquee {
          animation: employerLogoFullBleedMarquee ${duration}s linear infinite;
          will-change: transform;
        }
        .employer-logo-float {
          animation-name: employerLogoFloat;
          animation-timing-function: ease-in-out;
          animation-iteration-count: infinite;
          will-change: transform;
        }
      `}</style>

      <div
        className="employer-logo-full-bleed-marquee absolute left-0 top-0 flex"
      >
        {[0, 1].map((copyIndex) => (
          <div
            key={copyIndex}
            className="flex shrink-0"
            style={{ gap: BUBBLE_GAP, paddingRight: BUBBLE_GAP }}
          >
            {halfStrip.map((item, itemIndex) => renderBubble(item, `${copyIndex}-${itemIndex}`))}
          </div>
        ))}
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

  const industries = useMemo(() => stats?.demand || [], [stats])
  const employers = useMemo(() => stats?.featured_employers || [], [stats])
  const logoEmployers = useMemo(() => employers.filter((employer) => logoUrlFor(employer)), [employers])
  const industryGroups = useMemo(() => chunkItems(industries, INDUSTRIES_PER_PAGE), [industries])
  const employerGroups = useMemo(() => chunkItems(logoEmployers, EMPLOYERS_PER_PAGE), [logoEmployers])
  const industryCarousel = usePagedDrag(industryGroups.length)
  const employerCarousel = usePagedDrag(employerGroups.length)

  if (!stats || (industries.length === 0 && logoEmployers.length === 0)) return null

  return (
    <section className="overflow-hidden bg-white py-10">
      <div className="mx-auto max-w-6xl px-4">
        {industries.length > 0 && (
          <div>
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-xl font-extrabold text-[var(--brand-primary)]">Top ngành nghề nổi bật</h2>
              <div className="hidden items-center gap-2 sm:flex">
                <span className="mr-1 text-sm font-medium text-gray-500">
                  <span className="text-[var(--brand-primary)]">{industryCarousel.page + 1}</span>/{industryGroups.length}
                </span>
                <ArrowButton
                  dir="left"
                  disabled={!industryCarousel.canPrev}
                  onClick={industryCarousel.goPrev}
                  aria-label="Nhóm ngành nghề trước"
                />
                <ArrowButton
                  dir="right"
                  disabled={!industryCarousel.canNext}
                  onClick={industryCarousel.goNext}
                  aria-label="Nhóm ngành nghề tiếp theo"
                />
              </div>
            </div>

            <div
              className="cursor-grab select-none active:cursor-grabbing"
              {...industryCarousel.dragHandlers}
            >
              <PagedTrack
                groups={industryGroups}
                page={industryCarousel.page}
                dragOffset={industryCarousel.dragOffset}
                isDragging={industryCarousel.isDragging}
              >
                {(group) => (
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    {group.map((category) => {
                      const logoUrl = categoryLogoUrlFor(category)
                      return (
                        <button
                          key={category.id}
                          type="button"
                          onClick={() => navigate(`/viec-lam?cat=${category.id}`)}
                          className="group flex min-h-[156px] cursor-pointer flex-col items-center justify-center rounded-lg border border-transparent bg-[#F4F5F7] px-5 py-6 text-center transition hover:-translate-y-1 hover:border-[var(--brand-primary)] hover:bg-white hover:shadow-md hover:shadow-emerald-100"
                        >
                          {logoUrl && (
                            <span className="mb-5 flex h-16 w-16 items-center justify-center overflow-hidden rounded-2xl bg-white p-2 shadow-sm transition group-hover:scale-105 group-hover:border group-hover:border-emerald-100">
                              <img
                                src={logoUrl}
                                alt={category.name}
                                className="max-h-full max-w-full object-contain"
                                loading="lazy"
                                draggable={false}
                              />
                            </span>
                          )}
                          <span className="line-clamp-1 text-sm font-bold text-gray-800">{category.name}</span>
                          <span className="mt-2 text-xs font-medium text-[var(--brand-primary)]">
                            {formatNumber(category.count)} việc làm
                          </span>
                        </button>
                      )
                    })}
                  </div>
                )}
              </PagedTrack>
            </div>
          </div>
        )}

        {logoEmployers.length > 0 && (
          <div className="mt-8">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-xl font-extrabold text-[var(--brand-primary)]">Nhà tuyển dụng nổi bật</h2>
              <div className="hidden items-center gap-2 sm:flex">
                <span className="mr-1 text-sm font-medium text-gray-500">
                  <span className="text-[var(--brand-primary)]">{employerCarousel.page + 1}</span>/{employerGroups.length}
                </span>
                <ArrowButton
                  dir="left"
                  disabled={!employerCarousel.canPrev}
                  onClick={employerCarousel.goPrev}
                  aria-label="Nhóm nhà tuyển dụng trước"
                />
                <ArrowButton
                  dir="right"
                  disabled={!employerCarousel.canNext}
                  onClick={employerCarousel.goNext}
                  aria-label="Nhóm nhà tuyển dụng tiếp theo"
                />
              </div>
            </div>

            <style>{`
              .emp-card {
                position: relative;
                overflow: hidden;
                transition: transform 0.25s cubic-bezier(0.22,1,0.36,1), box-shadow 0.25s ease;
              }
              .emp-card::before {
                content: '';
                position: absolute;
                inset: 0;
                background: linear-gradient(135deg, rgba(0,177,79,0.07) 0%, rgba(61,220,132,0.04) 60%);
                opacity: 0;
                transition: opacity 0.25s ease;
                pointer-events: none;
                border-radius: inherit;
              }
              .emp-card:hover { transform: translateY(-5px); box-shadow: 0 16px 40px rgba(0,177,79,0.12), 0 4px 12px rgba(0,0,0,0.06); }
              .emp-card:hover::before { opacity: 1; }
              .emp-card-accent {
                position: absolute;
                bottom: 0; left: 0; right: 0;
                height: 3px;
                background: linear-gradient(90deg, var(--brand-primary), #3ddc84);
                transform: scaleX(0);
                transform-origin: left;
                transition: transform 0.3s ease;
                border-radius: 0 0 16px 16px;
              }
              .emp-card:hover .emp-card-accent { transform: scaleX(1); }
            `}</style>

            <div
              className="cursor-grab select-none active:cursor-grabbing"
              {...employerCarousel.dragHandlers}
            >
              <PagedTrack
                groups={employerGroups}
                page={employerCarousel.page}
                dragOffset={employerCarousel.dragOffset}
                isDragging={employerCarousel.isDragging}
              >
                {(group) => (
                  <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
                    {group.map((employer, idx) => (
                      <button
                        key={employer.public_id}
                        type="button"
                        onClick={() => navigate(`/viec-lam?search=${encodeURIComponent(employer.company_name)}&search_by=company`)}
                        className="emp-card group flex items-center justify-center rounded-2xl bg-[#f8faf8] px-6 py-8 cursor-pointer"
                        style={{ minHeight: idx % 3 === 0 ? 130 : 110 }}
                      >
                        <img
                          src={logoUrlFor(employer)}
                          alt={employer.company_name}
                          className="object-contain transition-transform duration-300 group-hover:scale-110"
                          style={{ width: idx % 3 === 0 ? 96 : 80, height: idx % 3 === 0 ? 96 : 80 }}
                          loading="lazy"
                          draggable={false}
                        />
                        <div className="emp-card-accent" />
                      </button>
                    ))}
                  </div>
                )}
              </PagedTrack>
            </div>

            <FloatingBubbleBelt employers={logoEmployers} navigate={navigate} />
          </div>
        )}
      </div>
    </section>
  )
}
