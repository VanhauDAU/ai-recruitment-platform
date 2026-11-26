import { useEffect, useRef } from 'react'
import { companyDetailPath } from '@/entities/company/company'
import { logoUrlFor } from '../lib/logo-url'

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
// Nửa dải chỉ cần rộng hơn màn hình lớn nhất; trước đây lặp cố định 12 lần nên với
// 9 công ty là 216 logo, mỗi logo một animation và một lớp compositing.
const MIN_HALF_STRIP_PX = 2560
const AVERAGE_BUBBLE_PX = 105 + BUBBLE_GAP

function seededRand(seed) {
  // Simple deterministic pseudo-random: xorshift
  let x = (seed * 1664525 + 1013904223) & 0xffffffff
  return ((x >>> 0) / 0xffffffff)
}

// Dải logo nhà tuyển dụng trôi ngang toàn màn hình với hiệu ứng bồng bềnh.
export default function EmployerLogoBelt({ employers, navigate }) {
  const beltRef = useRef(null)
  const hasEmployers = employers.length > 0

  // Khuất màn hình thì dừng animation: không tốn khung hình khi người dùng gõ ở chỗ khác.
  useEffect(() => {
    const belt = beltRef.current
    if (!belt || typeof IntersectionObserver !== 'function') return undefined
    const observer = new IntersectionObserver(([entry]) => {
      belt.classList.toggle('is-paused', !entry.isIntersecting)
    })
    observer.observe(belt)
    return () => observer.disconnect()
  }, [hasEmployers])

  if (!hasEmployers) return null

  const repeats = Math.max(1, Math.ceil(MIN_HALF_STRIP_PX / (employers.length * AVERAGE_BUBBLE_PX)))
  const halfStrip = Array.from({ length: repeats }, (_, repeatIndex) =>
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

  const renderBubble = ({ employer, size, top, slot }, i) => {
    const imagePadding = Math.max(9, Math.round(size * 0.18))
    const floatDistance = 3 + (slot % 4) * 1.5
    const floatDuration = 4.8 + (slot % 5) * 0.6
    return (
      <button
        key={`${employer.public_id || employer.company_name}-${i}`}
        type="button"
        onClick={() => navigate(companyDetailPath(employer))}
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
      ref={beltRef}
      className="employer-logo-belt relative left-1/2 mt-14 w-screen -translate-x-1/2 overflow-hidden bg-white"
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
        }
        .employer-logo-belt.is-paused .employer-logo-full-bleed-marquee,
        .employer-logo-belt.is-paused .employer-logo-float {
          animation-play-state: paused;
        }
        @media (prefers-reduced-motion: reduce) {
          .employer-logo-full-bleed-marquee,
          .employer-logo-float { animation: none; }
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
