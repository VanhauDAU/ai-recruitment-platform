import { useEffect, useMemo, useState } from 'react'
import { DownOutlined, LoadingOutlined } from '@ant-design/icons'
import { Empty, Skeleton } from 'antd'
import { Link, useParams } from 'react-router-dom'
import { getBanners } from '@/entities/site-settings'
import { getBlogCategories, getBlogPosts } from '@/entities/blog'
import { settingText, useSiteSettings } from '@/entities/site-settings'
import { BlogCategoryNav } from './ui/BlogCategoryBar'
import { BlogCardRow } from './ui/BlogCard'
import BlogInlineBanner from './ui/BlogInlineBanner'
import FeaturedPosts, { SectionHeading } from './ui/FeaturedPosts'
import { BLOG_ROOT } from './lib/blog-paths'

const PAGE_SIZE = 12

// Trang danh mục: khối nổi bật (4 bài mới nhất của danh mục) + 2 banner +
// danh sách bài viết với nút "Xem thêm" nạp nối tiếp (không phân trang).
export default function BlogCategory() {
  const { categorySlug } = useParams()
  const { settings } = useSiteSettings()
  const [categories, setCategories] = useState([])
  const [banners, setBanners] = useState([])
  const [posts, setPosts] = useState([])
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(false)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)

  const pageTitle = settingText(settings.blog_page_title, 'Cẩm nang nghề nghiệp')
  const activeCategory = useMemo(
    () => categories.find((c) => c.slug === categorySlug),
    [categories, categorySlug],
  )

  useEffect(() => {
    let cancelled = false
    getBlogCategories().then((data) => { if (!cancelled) setCategories(data || []) }).catch(() => {})
    getBanners('blog_inline').then((data) => { if (!cancelled) setBanners(data || []) }).catch(() => {})
    return () => { cancelled = true }
  }, [])

  // Đổi danh mục -> reset danh sách và nạp trang đầu.
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setPosts([])
    setPage(1)
    getBlogPosts({ category: categorySlug, page: 1, page_size: PAGE_SIZE })
      .then((res) => {
        if (cancelled) return
        setPosts(res.results || [])
        setHasMore(Boolean(res.next))
      })
      .catch(() => { if (!cancelled) { setPosts([]); setHasMore(false) } })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [categorySlug])

  useEffect(() => {
    document.title = activeCategory ? `${activeCategory.name} — ${pageTitle}` : pageTitle
  }, [activeCategory, pageTitle])

  async function loadMore() {
    const nextPage = page + 1
    setLoadingMore(true)
    try {
      const res = await getBlogPosts({ category: categorySlug, page: nextPage, page_size: PAGE_SIZE })
      setPosts((prev) => [...prev, ...(res.results || [])])
      setPage(nextPage)
      setHasMore(Boolean(res.next))
    } catch {
      setHasMore(false)
    } finally {
      setLoadingMore(false)
    }
  }

  const featured = posts.slice(0, 4)
  const listed = posts.slice(4)

  return (
    <div className="bg-white">
      <BlogCategoryNav categories={categories} activeSlug={categorySlug} />

      <div className="mx-auto max-w-6xl px-3 pb-8 pt-4 sm:px-4 sm:pb-10 sm:pt-5">
        <nav className="flex min-w-0 items-center overflow-hidden whitespace-nowrap text-xs text-slate-400 sm:text-sm">
          <Link to="/" className="shrink-0 hover:text-[var(--brand-primary)]">Trang chủ</Link>
          <span className="mx-1.5 shrink-0">›</span>
          <Link to={BLOG_ROOT} className="shrink-0 hover:text-[var(--brand-primary)]">{pageTitle}</Link>
          <span className="mx-1.5 shrink-0">›</span>
          <span className="truncate font-medium text-[var(--brand-primary)]">{activeCategory?.name || '...'}</span>
        </nav>
        <h1 className="mt-2 text-xl font-extrabold leading-7 text-slate-900 sm:text-3xl sm:leading-9">{activeCategory?.name || ''}</h1>
        {activeCategory?.description && <p className="mt-1 text-sm text-slate-500">{activeCategory.description}</p>}

        {loading ? (
          <CategorySkeleton />
        ) : posts.length === 0 ? (
          <Empty description="Danh mục chưa có bài viết" className="py-16" />
        ) : (
          <>
            <div className="mt-6">
              <FeaturedPosts posts={featured} />
            </div>

            {banners.length > 0 && (
              <div className="mt-7 grid auto-rows-fr grid-cols-1 gap-4 md:mt-8 md:grid-cols-2">
                <BlogInlineBanner banner={banners[0]} />
                {banners[1] && <BlogInlineBanner banner={banners[1]} />}
              </div>
            )}

            {(listed.length > 0 || hasMore) && (
              <div className="mt-10">
                <SectionHeading title="Danh sách bài viết" />
                <div className="grid grid-cols-1 gap-3 sm:gap-4 lg:grid-cols-2">
                  {listed.map((post) => <BlogCardRow key={post.public_id} post={post} large />)}
                  {loadingMore && Array.from({ length: 4 }).map((_, i) => <RowSkeleton key={`sk-${i}`} />)}
                </div>
                {hasMore && !loadingMore && (
                  <div className="mt-6 flex justify-center">
                    <button
                      type="button"
                      onClick={loadMore}
                      className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-[var(--brand-primary)] bg-white px-6 py-2.5 text-sm font-bold text-[var(--brand-primary)] transition-colors duration-200 hover:bg-[var(--brand-primary-soft)]"
                    >
                      Xem thêm bài viết
                      <DownOutlined className="text-xs" />
                    </button>
                  </div>
                )}
                {loadingMore && (
                  <div className="mt-6 flex justify-center text-[var(--brand-primary)]">
                    <LoadingOutlined className="text-xl" />
                  </div>
                )}
              </div>
            )}

            {banners.length > 2 && (
              <div className="mt-10">
                <BlogInlineBanner banner={banners[2]} />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

function RowSkeleton() {
  return (
    <div className="flex gap-3 rounded-2xl border border-slate-200 p-3 sm:gap-4">
      <Skeleton.Image active className="!h-24 !w-28 shrink-0 !rounded-xl sm:!w-40" />
      <Skeleton active title paragraph={{ rows: 1 }} className="flex-1 self-center" />
    </div>
  )
}

function CategorySkeleton() {
  return (
    <div className="mt-6">
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 p-4">
          <Skeleton.Image active className="!h-56 !w-full" />
          <Skeleton active paragraph={{ rows: 2 }} className="mt-4" />
        </div>
        <div className="flex flex-col gap-4">
          {Array.from({ length: 3 }).map((_, i) => <RowSkeleton key={i} />)}
        </div>
      </div>
    </div>
  )
}
