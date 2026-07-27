import { useEffect, useMemo } from 'react'
import { processBlogContent } from '../lib/blog-content'
import './blog-post-content.css'

export default function BlogPostContent({ html, onToc, className = '' }) {
  const processed = useMemo(() => processBlogContent(html), [html])

  useEffect(() => { onToc?.(processed.toc) }, [onToc, processed.toc])

  if (!processed.html) return null
  return (
    <div
      className={`blog-rich-content overflow-x-auto text-sm leading-7 text-slate-700 sm:text-[15px] [&_a]:break-words [&_a]:text-[var(--brand-primary)] [&_a]:underline [&_blockquote]:my-4 [&_blockquote]:border-l-4 [&_blockquote]:border-emerald-200 [&_blockquote]:pl-3 [&_blockquote]:text-slate-500 sm:[&_blockquote]:pl-4 [&_h2]:mt-7 [&_h2]:scroll-mt-28 [&_h2]:text-lg [&_h2]:font-bold [&_h2]:text-slate-900 sm:[&_h2]:mt-8 sm:[&_h2]:text-xl [&_h3]:mt-5 [&_h3]:scroll-mt-28 [&_h3]:text-base [&_h3]:font-bold [&_h3]:text-slate-800 sm:[&_h3]:mt-6 sm:[&_h3]:text-lg [&_img]:my-4 [&_img]:h-auto [&_img]:max-w-full [&_img]:rounded-lg sm:[&_img]:my-5 sm:[&_img]:rounded-xl [&_li]:mb-1 [&_li]:ml-4 sm:[&_li]:ml-5 [&_ol]:my-4 [&_ol]:list-decimal [&_p]:mb-4 [&_table]:my-5 [&_table]:min-w-[560px] [&_table]:border-collapse [&_td]:border [&_td]:border-slate-200 [&_td]:p-2 [&_th]:border [&_th]:border-slate-200 [&_th]:bg-slate-50 [&_th]:p-2 [&_ul]:my-4 [&_ul]:list-disc ${className}`}
      dangerouslySetInnerHTML={{ __html: processed.html }}
    />
  )
}
