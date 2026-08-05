import { BlogCardHero, BlogCardRow } from './BlogCard'

// Khối "Bài viết nổi bật" đổi bố cục theo lượng nội dung thực tế:
// 1-2 bài dùng card ảnh lớn cân bằng; từ 3 bài mới dùng hero + danh sách.
export default function FeaturedPosts({ posts, title = 'Bài viết nổi bật' }) {
  if (!posts?.length) return null
  const featuredPosts = posts.slice(0, 4)
  const [hero, ...rest] = featuredPosts
  const isSparse = featuredPosts.length <= 2
  const sparseLayout = featuredPosts.length === 1 ? 'solo' : 'duo'

  return (
    <section aria-labelledby="featured-posts-heading">
      <SectionHeading id="featured-posts-heading" title={title} />
      {isSparse ? (
        <div
          className={`grid grid-cols-1 gap-5 ${featuredPosts.length === 2 ? 'md:grid-cols-2' : ''}`}
          data-featured-layout={sparseLayout}
        >
          {featuredPosts.map((post) => (
            <BlogCardHero key={post.public_id} post={post} size={featuredPosts.length === 1 ? 'wide' : 'compact'} />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1.08fr)_minmax(0,0.92fr)]" data-featured-layout="editorial">
          <BlogCardHero post={hero} />
          <div
            className={`flex flex-col gap-4 ${featuredPosts.length === 3 ? 'lg:min-h-[480px]' : 'lg:min-h-[510px]'}`}
            data-featured-secondary-count={rest.length}
          >
            {rest.map((post) => (
              <BlogCardRow key={post.public_id} post={post} large fill />
            ))}
          </div>
        </div>
      )}
    </section>
  )
}

export function SectionHeading({ title, action, id }) {
  return (
    <div className="mb-4 flex items-start justify-between gap-2 sm:mb-5 sm:items-center sm:gap-3">
      <h2 id={id} className="relative min-w-0 pl-3 text-lg font-extrabold leading-6 text-slate-900 before:absolute before:left-0 before:top-1 before:h-[calc(100%-8px)] before:w-1 before:rounded-full before:bg-[var(--brand-primary)] sm:text-2xl sm:leading-8">
        {title}
      </h2>
      {action}
    </div>
  )
}
