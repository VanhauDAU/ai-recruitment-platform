import { BlogCardHero, BlogCardRow } from './BlogCard'

// Khối "Bài viết nổi bật": giữ hero bên trái và ba item bên phải. Trên desktop
// ba item chia đều chiều cao của cột hero, nên không bị hụt bởi độ dài nội dung.
export default function FeaturedPosts({ posts, title = 'Bài viết nổi bật' }) {
  if (!posts?.length) return null
  const [hero, ...rest] = posts

  return (
    <section>
      <SectionHeading title={title} />
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <BlogCardHero post={hero} />
        <div className="flex flex-col gap-4 lg:min-h-[510px]">
          {rest.slice(0, 3).map((post) => (
            <BlogCardRow key={post.public_id} post={post} large fill />
          ))}
        </div>
      </div>
    </section>
  )
}

export function SectionHeading({ title, action }) {
  return (
    <div className="mb-4 flex items-start justify-between gap-2 sm:mb-5 sm:items-center sm:gap-3">
      <h2 className="relative min-w-0 pl-3 text-lg font-extrabold leading-6 text-slate-900 before:absolute before:left-0 before:top-1 before:h-[calc(100%-8px)] before:w-1 before:rounded-full before:bg-[var(--brand-primary)] sm:text-2xl sm:leading-8">
        {title}
      </h2>
      {action}
    </div>
  )
}
