import { useEffect, useState } from 'react'
import { ProcvMascot } from '@/shared/ui/mascot'

const PHASES = [
  { emotion: 'happy', pose: 'wave' },
  { emotion: 'thinking', pose: 'neutral' },
  { emotion: 'success', pose: 'thumbsUp' },
]

function prefersReducedMotion() {
  if (typeof window === 'undefined') return false
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
}

export default function HomeHeroMascot() {
  const [phase, setPhase] = useState(0)

  useEffect(() => {
    if (prefersReducedMotion()) return undefined
    const timer = window.setInterval(() => {
      setPhase((current) => (current + 1) % PHASES.length)
    }, 3800)
    return () => window.clearInterval(timer)
  }, [])

  const current = PHASES[phase]
  return (
    <div className="home-hero-mascot" aria-hidden="true">
      <ProcvMascot
        size={132}
        emotion={current.emotion}
        pose={current.pose}
        float
        blink
        shadow="floating"
      />
    </div>
  )
}
