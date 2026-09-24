import { useEffect, useMemo, useState } from 'react'

const TYPE_INTERVAL_MS = 36

/** Hiện dần phản hồi theo typewriter, độc lập với hạ tầng phát âm thanh. */
export function useProgressiveReply({ active, progressive, reducedMotion, text }) {
  const characters = useMemo(() => Array.from(text || ''), [text])
  const [visibleCount, setVisibleCount] = useState(
    () => (progressive && !reducedMotion ? 0 : characters.length),
  )

  useEffect(() => {
    setVisibleCount(progressive && !reducedMotion ? 0 : characters.length)
  }, [characters, progressive, reducedMotion])

  useEffect(() => {
    if (!progressive || reducedMotion || !active) {
      setVisibleCount(characters.length)
      return undefined
    }
    if (visibleCount >= characters.length) return undefined
    const timer = window.setInterval(() => {
      setVisibleCount((current) => Math.min(characters.length, current + 1))
    }, TYPE_INTERVAL_MS)
    return () => window.clearInterval(timer)
  }, [active, characters.length, progressive, reducedMotion, visibleCount])

  return {
    complete: visibleCount >= characters.length,
    text: characters.slice(0, visibleCount).join(''),
    typing: visibleCount < characters.length,
  }
}
