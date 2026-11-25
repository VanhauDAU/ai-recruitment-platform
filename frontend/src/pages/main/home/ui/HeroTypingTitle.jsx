import { Typography } from 'antd'
import { useEffect, useState } from 'react'
import { useMediaQuery } from '@/shared/hooks/use-media-query'

const TAGLINES = ['Tạo CV', 'Tìm việc làm', 'Tuyển dụng hiệu quả']
const PHRASES = TAGLINES.map((phrase) => Array.from(phrase))
const HOLD_MS = 1800
const GAP_MS = 350

// Gõ từng ký tự rồi xóa, lần lượt qua PHRASES. Bắt đầu với cụm đầu đã gõ đủ để lần vẽ
// đầu tiên đã có chữ (không làm chậm LCP, không giật bố cục).
function useTypewriter(enabled) {
  const [state, setState] = useState({ index: 0, length: PHRASES[0].length, deleting: false })

  useEffect(() => {
    if (!enabled) return undefined
    const phrase = PHRASES[state.index]
    let delay
    let next
    if (!state.deleting && state.length === phrase.length) {
      delay = HOLD_MS
      next = { ...state, deleting: true }
    } else if (state.deleting && state.length === 0) {
      delay = GAP_MS
      next = { index: (state.index + 1) % PHRASES.length, length: 0, deleting: false }
    } else {
      // Gõ chậm và hơi lệch nhịp như người thật; xóa nhanh, đều.
      delay = state.deleting ? 32 : 70 + Math.random() * 60
      next = { ...state, length: state.length + (state.deleting ? -1 : 1) }
    }
    const timer = window.setTimeout(() => setState(next), delay)
    return () => window.clearTimeout(timer)
  }, [enabled, state])

  const phrase = PHRASES[state.index]
  return {
    text: phrase.slice(0, state.length).join(''),
    resting: !state.deleting && state.length === phrase.length,
  }
}

/** Tiêu đề hero: điện thoại gõ lần lượt từng vế; desktop và người tắt chuyển động thấy câu tĩnh. */
export default function HeroTypingTitle({ siteName }) {
  const isPhone = useMediaQuery('(max-width: 767px)')
  const reducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)')
  const typing = isPhone && !reducedMotion
  const { text, resting } = useTypewriter(typing)
  const fullTitle = `${siteName} — ${TAGLINES.join(', ')}`

  return (
    <Typography.Title level={1} className="!text-white !mb-3 !mt-5 !text-3xl md:!text-4xl !font-extrabold">
      {typing ? (
        <>
          <span className="sr-only">{fullTitle}</span>
          <span aria-hidden="true" className="home-typing">
            <span className="home-typing-brand">{siteName}</span>
            <span className="home-typing-line">
              <span className="home-typing-text">{text}</span>
              <span className="home-typing-caret" data-resting={resting || undefined} />
            </span>
          </span>
        </>
      ) : (
        fullTitle
      )}
    </Typography.Title>
  )
}
