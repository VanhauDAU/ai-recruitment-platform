import { useMemo } from 'react'
import { sanitizeHtml } from '@/shared/lib/sanitize-html'

export default function RichJobContent({ html }) {
  const safeHtml = useMemo(() => sanitizeHtml(html), [html])
  if (!safeHtml) return null
  if (!/<\/?[a-z][\s\S]*>/i.test(html)) {
    return <p className="whitespace-pre-line text-sm leading-6 text-slate-600">{html}</p>
  }
  return (
    <div
      className="job-rich-content text-sm leading-6 text-slate-600 [&_a]:text-[var(--brand-primary)] [&_a]:underline [&_blockquote]:border-l-4 [&_blockquote]:border-emerald-200 [&_blockquote]:pl-4 [&_h2]:mt-5 [&_h2]:text-lg [&_h2]:font-bold [&_h2]:text-slate-800 [&_h3]:mt-4 [&_h3]:font-bold [&_h3]:text-slate-800 [&_img]:my-4 [&_img]:max-w-full [&_img]:rounded-xl [&_li]:ml-5 [&_li]:pl-1 [&_ol]:my-3 [&_ol]:list-decimal [&_p]:mb-3 [&_table]:my-4 [&_table]:w-full [&_table]:border-collapse [&_td]:border [&_td]:border-slate-200 [&_td]:p-2 [&_th]:border [&_th]:border-slate-200 [&_th]:bg-slate-50 [&_th]:p-2 [&_ul]:my-3 [&_ul]:list-disc"
      dangerouslySetInnerHTML={{ __html: safeHtml }}
    />
  )
}
