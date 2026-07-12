import { Link } from 'react-router-dom'
import { blogPostPath, formatBlogDate } from '@/entities/blog'

export function PostThumb({ post, className = '' }) {
  return (
    <div className={`overflow-hidden bg-slate-100 ${className}`}>
      {post.thumbnail_url ? (
        <img
          src={post.thumbnail_url}
          alt={post.title}
          loading="lazy"
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-[var(--brand-primary-soft)] to-emerald-100 transition-transform duration-500 group-hover:scale-110">
          <span className="text-3xl font-black text-[var(--brand-primary)] opacity-30">{post.title?.[0] || 'B'}</span>
        </div>
      )}
    </div>
  )
}

// Card bài viết dạng đứng: ảnh trên, nội dung dưới. Excerpt được sinh từ phần
// mở đầu content ở backend nên không cần duy trì trường summary riêng.
export default function BlogCard({ post }) {
  return (
    <Link to={blogPostPath(post.slug)} target="_blank" rel="noopener" className="group block">
      <article className="flex h-full flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white transition-all duration-300 group-hover:-translate-y-1 group-hover:border-emerald-200 group-hover:shadow-xl group-hover:shadow-emerald-900/10">
        <PostThumb post={post} className="aspect-[16/9]" />
        <div className="flex flex-1 flex-col gap-2 p-3.5 sm:p-4">
          {post.category && (
            <span className="w-fit text-xs font-semibold uppercase tracking-wide text-[var(--brand-primary)]">
              {post.category.name}
            </span>
          )}
          <h3 className="line-clamp-2 text-sm font-bold leading-5 text-slate-800 transition-colors duration-300 group-hover:text-[var(--brand-primary)] sm:text-base sm:leading-6">
            {post.title}
          </h3>
          {post.excerpt && (
            <p className="line-clamp-3 text-sm leading-5 text-slate-500">{post.excerpt}</p>
          )}
          <time className="mt-auto pt-1 text-xs text-slate-400">{formatBlogDate(post.published_at)}</time>
        </div>
      </article>
    </Link>
  )
}

// Card ngang: thumb trái, tiêu đề phải — dùng cho cột phải khối nổi bật và
// các section cần bố cục khác nhau.
export function BlogCardRow({ post, large = false, fill = false }) {
  return (
    <Link to={blogPostPath(post.slug)} target="_blank" rel="noopener" className={`group block ${fill ? 'lg:min-h-0 lg:flex-1' : ''}`}>
      <article className="flex h-full items-stretch overflow-hidden rounded-2xl border border-slate-200 bg-white transition-all duration-300 group-hover:-translate-y-0.5 group-hover:border-emerald-200 group-hover:shadow-lg group-hover:shadow-emerald-900/10">
        <PostThumb post={post} className={`shrink-0 ${large ? 'w-[40%] sm:w-[43%]' : 'w-[36%] sm:w-[38%]'} aspect-[16/10]`} />
        <div className="flex min-w-0 flex-1 flex-col justify-center gap-1.5 p-3 sm:p-4">
          {post.category && (
            <span className="text-[11px] font-semibold uppercase tracking-wide text-[var(--brand-primary)]">
              {post.category.name}
            </span>
          )}
          <h3 className={`font-bold leading-snug text-slate-800 transition-colors duration-300 group-hover:text-[var(--brand-primary)] ${large ? 'line-clamp-2 text-sm sm:text-base' : 'line-clamp-2 text-sm'}`}>
            {post.title}
          </h3>
          {post.excerpt && <p className="line-clamp-2 text-xs leading-4 text-slate-500">{post.excerpt}</p>}
          <time className="text-xs text-slate-400">{formatBlogDate(post.published_at)}</time>
        </div>
      </article>
    </Link>
  )
}

// Card lớn cho ô trái khối "Bài viết nổi bật": ảnh cao, tiêu đề to.
export function BlogCardHero({ post }) {
  return (
    <Link to={blogPostPath(post.slug)} target="_blank" rel="noopener" className="group block h-full">
      <article className="flex h-full flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white transition-all duration-300 group-hover:-translate-y-1 group-hover:border-emerald-200 group-hover:shadow-xl group-hover:shadow-emerald-900/10">
        <PostThumb post={post} className="aspect-[16/9]" />
        <div className="flex flex-1 flex-col gap-2 p-4 sm:p-5">
          {post.category && (
            <span className="w-fit text-xs font-semibold uppercase tracking-wide text-[var(--brand-primary)]">
              {post.category.name}
            </span>
          )}
          <h3 className="line-clamp-2 text-lg font-bold leading-6 text-slate-900 transition-colors duration-300 group-hover:text-[var(--brand-primary)] sm:text-xl sm:leading-7">
            {post.title}
          </h3>
          {post.excerpt && <p className="line-clamp-3 text-sm leading-5 text-slate-500">{post.excerpt}</p>}
          <time className="mt-auto pt-1 text-xs text-slate-400">{formatBlogDate(post.published_at)}</time>
        </div>
      </article>
    </Link>
  )
}
