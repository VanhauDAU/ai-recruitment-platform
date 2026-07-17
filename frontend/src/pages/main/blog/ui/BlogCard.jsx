import { ArrowRightOutlined } from '@ant-design/icons'
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
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-[var(--brand-primary-soft)] to-emerald-100 transition-transform duration-500 group-hover:scale-105">
          <span className="text-3xl font-black text-[var(--brand-primary)] opacity-30">{post.title?.[0] || 'B'}</span>
        </div>
      )}
    </div>
  )
}

// Card đứng: dùng trong lưới danh sách
export default function BlogCard({ post }) {
  return (
    <Link to={blogPostPath(post.slug)} target="_blank" rel="noopener" className="group block">
      <article className="flex h-full flex-col overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm transition-all duration-300 group-hover:-translate-y-1 group-hover:shadow-xl group-hover:shadow-slate-200/80">
        <PostThumb post={post} className="aspect-[16/9]" />
        <div className="flex flex-1 flex-col gap-2 p-4">
          {post.category && (
            <span className="w-fit text-[11px] font-bold uppercase tracking-widest text-[var(--brand-primary)]">
              {post.category.name}
            </span>
          )}
          <h3 className="line-clamp-2 text-sm font-bold leading-5 text-slate-800 transition-colors duration-300 group-hover:text-[var(--brand-primary)] sm:text-base sm:leading-6">
            {post.title}
          </h3>
          {post.excerpt && (
            <p className="line-clamp-2 text-sm leading-5 text-slate-500">{post.excerpt}</p>
          )}
          <div className="mt-auto flex items-center justify-between pt-2">
            <time className="text-xs text-slate-400">{formatBlogDate(post.published_at)}</time>
            <span className="text-xs font-semibold text-[var(--brand-primary)] opacity-0 transition-opacity duration-200 group-hover:opacity-100">
              Đọc thêm →
            </span>
          </div>
        </div>
      </article>
    </Link>
  )
}

// Card ngang: thumbnail nhỏ bên phải, text bên trái — dùng cho cột phải khối nổi bật
export function BlogCardRow({ post, large = false, fill = false }) {
  return (
    <Link
      to={blogPostPath(post.slug)}
      target="_blank"
      rel="noopener"
      className={`group block ${fill ? 'lg:min-h-0 lg:flex-1' : ''}`}
    >
      <article className="flex h-full items-stretch overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm transition-all duration-300 group-hover:-translate-y-0.5 group-hover:shadow-lg group-hover:shadow-slate-200/80">
        {/* Nội dung bên trái */}
        <div className="flex min-w-0 flex-1 flex-col justify-center gap-1.5 p-3.5 sm:p-4">
          {post.category && (
            <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--brand-primary)]">
              {post.category.name}
            </span>
          )}
          <h3
            className={`font-bold leading-snug text-slate-800 transition-colors duration-300 group-hover:text-[var(--brand-primary)] ${
              large ? 'line-clamp-2 text-sm sm:text-base' : 'line-clamp-2 text-sm'
            }`}
          >
            {post.title}
          </h3>
          {post.excerpt && (
            <p className="line-clamp-2 text-xs leading-4 text-slate-500">{post.excerpt}</p>
          )}
          <div className="mt-auto flex items-center gap-2 pt-1">
            <time className="text-[11px] text-slate-400">{formatBlogDate(post.published_at)}</time>
          </div>
        </div>

        {/* Thumbnail bên phải */}
        <PostThumb
          post={post}
          className={`shrink-0 ${large ? 'w-[38%] sm:w-[42%]' : 'w-[34%] sm:w-[38%]'} aspect-[4/3]`}
        />
      </article>
    </Link>
  )
}

// Hero card: ảnh đầy + overlay gradient + text đè lên dưới — dùng cho ô trái khối nổi bật
export function BlogCardHero({ post }) {
  return (
    <Link to={blogPostPath(post.slug)} target="_blank" rel="noopener" className="group block h-full">
      <article className="relative flex h-full min-h-[360px] flex-col overflow-hidden rounded-2xl shadow-md transition-all duration-300 group-hover:-translate-y-1 group-hover:shadow-2xl group-hover:shadow-slate-300/60 sm:min-h-[420px]">
        {/* Full-bleed thumbnail */}
        <PostThumb post={post} className="absolute inset-0 h-full w-full" />

        {/* Gradient overlay bottom */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />

        {/* Category badge top-left */}
        {post.category && (
          <div className="relative z-10 p-4">
            <span className="inline-block rounded-full bg-[var(--brand-primary)] px-3 py-1 text-[11px] font-bold uppercase tracking-widest text-white shadow-sm">
              {post.category.name}
            </span>
          </div>
        )}

        {/* Text block anchored to bottom */}
        <div className="relative z-10 mt-auto p-4 sm:p-5">
          <h3 className="line-clamp-3 text-lg font-extrabold leading-6 text-white drop-shadow-sm transition-colors duration-300 group-hover:text-emerald-200 sm:text-xl sm:leading-7">
            {post.title}
          </h3>
          {post.excerpt && (
            <p className="mt-1.5 line-clamp-2 text-sm leading-5 text-white/75">{post.excerpt}</p>
          )}
          <div className="mt-3 flex items-center justify-between">
            <time className="text-xs text-white/60">{formatBlogDate(post.published_at)}</time>
            <span className="inline-flex items-center gap-1 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold text-white backdrop-blur-sm transition-all duration-200 group-hover:bg-[var(--brand-primary)] group-hover:text-white">
              Xem thêm <ArrowRightOutlined style={{ fontSize: 10 }} />
            </span>
          </div>
        </div>
      </article>
    </Link>
  )
}
