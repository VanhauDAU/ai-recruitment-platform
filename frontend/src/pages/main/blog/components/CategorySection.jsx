import { ArrowRightOutlined } from '@ant-design/icons'
import { Link } from 'react-router-dom'
import BlogCard, { BlogCardHero, BlogCardRow } from './BlogCard'
import { SectionHeading } from './FeaturedPosts'
import { blogCategoryPath } from '../blogPaths'

// Một section danh mục trên trang /blog: tiêu đề + nút xem tất cả + 4 bài mới
// nhất. `variant` xoay vòng để các section có bố cục khác nhau.
export default function CategorySection({ category, posts, variant = 0 }) {
  if (!posts?.length) return null

  return (
    <section>
      <SectionHeading
        title={category.name}
        action={<ViewAllLink to={blogCategoryPath(category.slug)} />}
      />
      {variant % 3 === 0 && (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {posts.map((post) => <BlogCard key={post.public_id} post={post} />)}
        </div>
      )}
      {variant % 3 === 1 && (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          <div className="order-2 flex flex-col gap-4 lg:order-1 lg:min-h-[510px]">
            {posts.slice(1, 4).map((post) => <BlogCardRow key={post.public_id} post={post} large fill />)}
          </div>
          <div className="order-1 lg:order-2">
            <BlogCardHero post={posts[0]} />
          </div>
        </div>
      )}
      {variant % 3 === 2 && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {posts.map((post) => <BlogCardRow key={post.public_id} post={post} />)}
        </div>
      )}
    </section>
  )
}

export function ViewAllLink({ to, label = 'Xem tất cả' }) {
  return (
    <Link
      to={to}
      className="group/link inline-flex shrink-0 items-center gap-1 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-[var(--brand-primary)] transition-colors duration-200 hover:border-[var(--brand-primary)] hover:bg-[var(--brand-primary-soft)] sm:gap-1.5 sm:px-4 sm:text-sm"
    >
      {label}
      <ArrowRightOutlined className="text-xs transition-transform duration-200 group-hover/link:translate-x-0.5" />
    </Link>
  )
}
