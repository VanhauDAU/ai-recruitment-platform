import { useMemo } from 'react'
import { sanitizeHtml } from '@/shared/lib/sanitize-html'
import './knowledge-article-content.css'

export default function KnowledgeArticleContent({ html, className = '' }) {
  const safeHtml = useMemo(() => sanitizeHtml(html), [html])
  if (!safeHtml) return null
  return (
    <div
      className={`knowledge-article-content ${className}`.trim()}
      dangerouslySetInnerHTML={{ __html: safeHtml }}
    />
  )
}
