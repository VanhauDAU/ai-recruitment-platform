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
const MARQUEE_REPEATS_PER_HALF = 12

function seededRand(seed) {
  // Simple deterministic pseudo-random: xorshift
  let x = (seed * 1664525 + 1013904223) & 0xffffffff
  return ((x >>> 0) / 0xffffffff)
}

// Dải logo nhà tuyển dụng trôi ngang toàn màn hình với hiệu ứng bồng bềnh.
export default function EmployerLogoBelt({ employers, navigate }) {
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
