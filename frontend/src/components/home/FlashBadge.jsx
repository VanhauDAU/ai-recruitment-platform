import { ArrowRightOutlined, ThunderboltFilled } from '@ant-design/icons'
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getJobs } from '../../api/jobService'
import { companyInitial, formatNumber as fmt } from '../../constants/jobOptions'
import { useCountUp } from '../../hooks/useCountUp'

const CYCLE_HOURS = 4
const VISIBLE = 3
const ROTATE_MS = 3500
const ITEM_H = 72   // height của mỗi card (px)
const GAP    = 8    // khoảng cách giữa các card (px)
const SLOT   = ITEM_H + GAP
const pad = (n) => String(n).padStart(2, '0')

function useCountdown() {
  const [left, setLeft] = useState({ h: 0, m: 0, s: 0 })
  useEffect(() => {
    const tick = () => {
      const now = new Date()
      const next = new Date(now)
      const nextHour = (Math.floor(now.getHours() / CYCLE_HOURS) + 1) * CYCLE_HOURS
      next.setHours(nextHour, 0, 0, 0)
      const diff = Math.max(0, Math.floor((next - now) / 1000))
      setLeft({ h: Math.floor(diff / 3600), m: Math.floor((diff % 3600) / 60), s: diff % 60 })
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [])
  return left
}

/**
 * useJobQueue – quản lý danh sách hiển thị theo slot position.
 * Mỗi item: { job, id, slot }
 *   slot = 0 → top, slot = VISIBLE-1 → bottom
 *   slot = -1 → đang vào từ trên (off-screen above)
 *   slot = VISIBLE → đang ra khỏi dưới (off-screen below) + opacity 0
 */
function useJobQueue(jobs) {
  const [items, setItems] = useState([])  // [{ job, id, slot }]
  const nextIdxRef = useRef(0)
  const idCounterRef = useRef(0)

  // Khởi tạo khi jobs load xong
  useEffect(() => {
    if (jobs.length === 0) return
    const initial = jobs.slice(0, Math.min(VISIBLE, jobs.length)).map((job, slot) => ({
      job,
      id: idCounterRef.current++,
      slot,
    }))
    setItems(initial)
    nextIdxRef.current = initial.length % jobs.length
  }, [jobs])

  // Rotate: thêm job mới vào slot -1, đẩy mọi thứ xuống 1 slot, item ở slot VISIBLE-1 đi ra
  useEffect(() => {
    if (jobs.length <= VISIBLE) return
    const timer = setInterval(() => {
      const newJob = jobs[nextIdxRef.current]
      nextIdxRef.current = (nextIdxRef.current + 1) % jobs.length
      const newId = idCounterRef.current++

      setItems((prev) => {
        // Đẩy tất cả xuống 1 slot (item cuối sẽ thành slot VISIBLE = off-screen)
        const shifted = prev.map((item) => ({ ...item, slot: item.slot + 1 }))
        // Thêm item mới ở slot -1 (off-screen above) → transition sẽ đưa về 0
        return [{ job: newJob, id: newId, slot: -1 }, ...shifted]
      })

      // Một frame sau: chuyển item mới từ slot -1 → 0 (trigger transition)
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setItems((prev) =>
            prev.map((item) => (item.id === newId ? { ...item, slot: 0 } : item)),
          )
        })
      })

      // Sau khi animation xong: xóa item đã ra ngoài
      setTimeout(() => {
        setItems((prev) => prev.filter((item) => item.slot < VISIBLE))
      }, 600)
    }, ROTATE_MS)
    return () => clearInterval(timer)
  }, [jobs])

  return items
}

export default function FlashBadge() {
  const navigate = useNavigate()
  const [jobs, setJobs] = useState([])
  const [count, setCount] = useState(0)
  const { h, m, s } = useCountdown()
  const displayCount = useCountUp(count)
  const items = useJobQueue(jobs)

  useEffect(() => {
    getJobs({ page_size: 20 })
      .then((data) => {
        const results = data.results || data
        setJobs(results)
        setCount(data.count ?? results.length)
      })
      .catch(() => {})
  }, [])

  // Tổng chiều cao container cố định
  const containerH = VISIBLE * ITEM_H + (VISIBLE - 1) * GAP

  return (
    <div className="relative overflow-hidden bg-gradient-to-br from-[#0aa14a] via-[#02893c] to-[#046b32] text-white">
      {/* Background decorations */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-32 right-1/4 h-96 w-96 rounded-full bg-[#5dffa3]/15 blur-3xl" />
        <div className="absolute -bottom-24 left-0 h-72 w-72 rounded-full bg-[#3ddc84]/15 blur-3xl" />
        <div className="absolute top-0 right-0 h-full w-1/3 bg-gradient-to-l from-[#035e2b]/40 to-transparent" />
        <svg className="absolute inset-0 h-full w-full opacity-[0.04]" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="fbgrid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="white" strokeWidth="1" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#fbgrid)" />
        </svg>
      </div>

      <div className="relative max-w-6xl mx-auto grid grid-cols-1 gap-6 px-4 py-6 md:py-8 lg:grid-cols-[1fr_340px_240px]">

        {/* ── Cột trái ── */}
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="flex items-center justify-center w-7 h-7 rounded-full bg-[#ffe27a]/20 ring-1 ring-[#ffe27a]/40">
              <ThunderboltFilled className="text-[#ffe27a] text-xs" />
            </span>
            <span className="text-xs font-semibold uppercase tracking-[0.15em] text-[#a8f5cc]">
              Flash Badge
            </span>
          </div>
          <h2 className="text-2xl md:text-3xl font-extrabold tracking-tight leading-tight">
            Huy Hiệu{' '}
            <span className="bg-gradient-to-r from-[#ffe27a] to-[#ffc107] bg-clip-text text-transparent">
              Sấm Chớp
            </span>
          </h2>
          <p className="mt-2 max-w-[280px] text-sm text-green-50/80 leading-relaxed">
            Ghi nhận sự tương tác thường xuyên của Nhà tuyển dụng với ứng viên
          </p>

          <div className="mt-4 inline-flex items-center gap-2.5 rounded-xl bg-white/10 px-4 py-2.5 backdrop-blur-sm ring-1 ring-white/20 shadow-inner">
            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-[#ffe27a]/20">
              <ThunderboltFilled className="text-[#ffe27a]" />
            </div>
            <div>
              <span className="text-2xl font-bold tabular-nums leading-none">{fmt(displayCount)}</span>
              <p className="text-[11px] text-green-50/75 leading-tight mt-0.5 max-w-[190px]">
                tin đăng được NTD tương tác trong 24 giờ qua
              </p>
            </div>
          </div>

          <div className="mt-5">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-green-50/60 mb-2">
              Tự động cập nhật sau
            </p>
            <div className="flex items-center gap-1.5">
              {[
                { v: h, u: 'Giờ' },
                { v: m, u: 'Phút' },
                { v: s, u: 'Giây' },
              ].map((seg, i) => (
                <div key={seg.u} className="flex items-center gap-1.5">
                  {i > 0 && <span className="text-lg font-bold text-[#ffe27a]/80 mb-3">:</span>}
                  <div className="flex flex-col items-center">
                    <span className="flex h-10 w-11 items-center justify-center rounded-lg bg-white text-xl font-extrabold tabular-nums text-[#046b32] shadow-md ring-1 ring-black/10">
                      {pad(seg.v)}
                    </span>
                    <span className="mt-1 text-[10px] text-green-50/70">{seg.u}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Cột giữa: Job feed ── */}
        <div className="flex flex-col justify-center">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-[0.12em] text-green-50/60">
              Tin nổi bật
            </span>
            <span className="flex items-center gap-1.5 text-[10px] text-green-50/50">
              <span className="w-1.5 h-1.5 rounded-full bg-[#5dffa3] animate-pulse inline-block" />
              Đang cập nhật
            </span>
          </div>

          {/* Container cố định chiều cao, overflow:hidden để clip card ra ngoài */}
          <div
            className="relative overflow-hidden"
            style={{ height: containerH }}
          >
            {items.length === 0
              ? Array.from({ length: VISIBLE }).map((_, i) => (
                  <div
                    key={i}
                    className="absolute w-full rounded-xl bg-white/10 animate-pulse"
                    style={{ height: ITEM_H, top: i * SLOT }}
                  />
                ))
              : items.map(({ job, id, slot }) => {
                  // slot -1 → trên ngoài, slot VISIBLE → dưới ngoài
                  const topPx = slot * SLOT
                  const isOffscreen = slot < 0 || slot >= VISIBLE
                  return (
                    <div
                      key={id}
                      onClick={() => !isOffscreen && navigate(`/jobs/${job.slug}`)}
                      style={{
                        position: 'absolute',
                        width: '100%',
                        height: ITEM_H,
                        top: topPx,
                        opacity: isOffscreen ? 0 : 1,
                        transform: isOffscreen
                          ? slot < 0
                            ? 'translateY(-12px) scale(0.97)'
                            : 'translateY(12px) scale(0.97)'
                          : 'translateY(0) scale(1)',
                        transition: 'top 0.5s cubic-bezier(0.4,0,0.2,1), opacity 0.45s ease, transform 0.45s ease',
                        pointerEvents: isOffscreen ? 'none' : 'auto',
                      }}
                      className="group flex cursor-pointer items-center gap-3 rounded-xl bg-white/95 p-3 text-gray-800 shadow-md ring-1 ring-black/5 hover:bg-white hover:shadow-lg"
                    >
                      <div className="relative shrink-0">
                        <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-[#eafaf1] to-[#d1fae5] text-base font-bold text-[#02893c] shadow-sm ring-1 ring-[#02893c]/10">
                          {companyInitial(job.company_name)}
                        </span>
                        <span className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-gradient-to-br from-[#ffda00] to-[#ff8c00] text-[9px] text-white shadow-sm ring-2 ring-white">
                          <ThunderboltFilled />
                        </span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-gray-900 group-hover:text-[#02893c] transition-colors">
                          {job.title}
                        </p>
                        <p className="truncate text-xs text-gray-500 mt-0.5">{job.company_name}</p>
                      </div>
                      <ArrowRightOutlined className="text-gray-300 group-hover:text-[#02893c] transition-colors shrink-0 text-xs" />
                    </div>
                  )
                })}
          </div>
        </div>

        {/* ── Cột phải: Badge + CTA ── */}
        <div className="flex flex-col items-center justify-center text-center">
          <div className="relative">
            <div className="absolute inset-0 rounded-full bg-[#5dffa3]/20 blur-2xl scale-125" />
            <LightningBadge />
          </div>
          <p className="mt-3 text-sm font-medium leading-snug text-green-50/90">
            Danh sách tin đăng đạt
            <br />
            <span className="font-bold text-white">Huy hiệu Sấm Chớp</span>
          </p>
          <button
            onClick={() => navigate('/jobs')}
            className="mt-4 inline-flex items-center gap-2 rounded-full bg-white px-5 py-2 text-sm font-semibold text-[#02893c] shadow-md transition-all hover:bg-green-50 hover:shadow-lg hover:-translate-y-px active:scale-95 cursor-pointer"
          >
            Xem ngay <ArrowRightOutlined className="text-xs" />
          </button>
        </div>
      </div>
    </div>
  )
}

function LightningBadge() {
  return (
    <svg
      viewBox="0 0 140 150"
      className="w-32 h-auto drop-shadow-[0_12px_30px_rgba(0,0,0,0.3)]"
      role="img"
      aria-label="Huy hiệu Sấm Chớp"
    >
      <defs>
        <linearGradient id="badgeFace2" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#7fffba" />
          <stop offset="50%" stopColor="#1fbf63" />
          <stop offset="100%" stopColor="#0a6630" />
        </linearGradient>
        <linearGradient id="badgeEdge2" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.7" />
          <stop offset="100%" stopColor="#0a7a3a" stopOpacity="0.3" />
        </linearGradient>
        <linearGradient id="bolt2" x1="0" y1="0" x2="0.3" y2="1">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="60%" stopColor="#ffe27a" />
          <stop offset="100%" stopColor="#ffa500" />
        </linearGradient>
        <filter id="glow2">
          <feGaussianBlur stdDeviation="3" result="blur" />
          <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>
      <polygon points="70,4 130,37 130,107 70,144 10,107 10,37" fill="url(#badgeEdge2)" stroke="rgba(255,255,255,0.4)" strokeWidth="1" />
      <polygon points="70,14 121,43 121,101 70,132 19,101 19,43" fill="url(#badgeFace2)" />
      <polygon points="70,14 121,43 121,72 70,72" fill="rgba(255,255,255,0.12)" />
      <polygon points="70,14 121,43 121,101 70,132 19,101 19,43" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="1.5" />
      <path d="M80 38 L51 82 L68 82 L59 114 L93 65 L74 65 Z" fill="url(#bolt2)" filter="url(#glow2)" stroke="rgba(10,102,48,0.2)" strokeWidth="0.5" strokeLinejoin="round" />
    </svg>
  )
}
