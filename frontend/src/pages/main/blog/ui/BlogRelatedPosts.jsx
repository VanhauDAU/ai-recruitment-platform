import { Link } from 'react-router'
import { blogCategoryPath } from '@/entities/blog'
import BlogCard from './BlogCard'
import { SectionHeading } from './FeaturedPosts'

// Section full-width dưới layout chi tiết (12 cột): 3 bài / hàng trên desktop.
export default function BlogRelatedPosts({ posts = [], category }) {
  if (!posts.length) return null

  const moreLink = category?.slug ? (
    <Link
      to={blogCategoryPath(category.slug)}
      className="shrink-0 text-sm font-semibold text-[var(--brand-primary)] hover:underline"
    >
      Xem thêm {category.name}
    </Link>
  ) : null

  return (
    <section
      className="w-full rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_1px_3px_rgba(15,23,42,0.05)] sm:p-6"
      aria-labelledby="blog-related-heading"
    >
      <SectionHeading id="blog-related-heading" title="Bài viết liên quan" action={moreLink} />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {posts.slice(0, 6).map((post) => (
          <BlogCard key={post.public_id || post.slug} post={post} />
        ))}
      </div>
    </section>
  )
}
