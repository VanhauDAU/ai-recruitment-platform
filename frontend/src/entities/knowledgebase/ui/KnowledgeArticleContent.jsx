import { useEffect, useMemo, useRef } from 'react'
import { sanitizeHtml } from '@/shared/lib/sanitize-html'
import './knowledge-article-content.css'

export default function KnowledgeArticleContent({ html, className = '' }) {
  const safeHtml = useMemo(() => sanitizeHtml(html), [html])
  const contentRef = useRef(null)

  useEffect(() => {
    const images = Array.from(contentRef.current?.querySelectorAll('img') || [])
    const cleanup = images.map((image) => {
      image.setAttribute('loading', 'lazy')
      image.setAttribute('decoding', 'async')
      const markBroken = () => {
        image.classList.add('is-broken')
        image.setAttribute('data-load-error', 'true')
      }
      image.addEventListener('error', markBroken)
      if (image.complete && image.naturalWidth === 0) markBroken()
      return () => image.removeEventListener('error', markBroken)
    })
    return () => cleanup.forEach((removeListener) => removeListener())
  }, [safeHtml])

  if (!safeHtml) return null
  return (
    <div
      ref={contentRef}
      className={`knowledge-article-content ${className}`.trim()}
      dangerouslySetInnerHTML={{ __html: safeHtml }}
    />
  )
}
