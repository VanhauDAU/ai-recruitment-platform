import { Fragment, useEffect, useState } from 'react'
import { DownOutlined, LoadingOutlined } from '@ant-design/icons'
import { Empty, Skeleton } from 'antd'
import { Link, useSearchParams } from 'react-router'
import { getBanners, settingText, useSiteSettings } from '@/entities/site-settings'
import { BLOG_ROOT, getBlogCategories, getBlogHome, getBlogPosts } from '@/entities/blog'
import { legacyAsset } from '@/shared/config/assets'
import { useDocumentMetadata } from '@/shared/hooks/use-document-metadata'
import BlogCard from './ui/BlogCard'
import { BlogCategoryNav } from './ui/BlogCategoryBar'
import BlogInlineBanner from './ui/BlogInlineBanner'
import CategorySection from './ui/CategorySection'
import FeaturedPosts, { SectionHeading } from './ui/FeaturedPosts'

const TAG_PAGE_SIZE = 12

// Trang /blog kiểu magazine: khối nổi bật + mỗi danh mục một section (bố cục
// xoay vòng, nền xen kẽ), banner "ảnh giả button" chèn giữa các section.
// Khi có ?tag=<slug> chuyển sang danh sách lọc theo thẻ (cùng API list).
export default function BlogHome() {
  const { settings } = useSiteSettings()
  const [searchParams] = useSearchParams()
  const tagSlug = (searchParams.get('tag') || '').trim()
  const [categories, setCategories] = useState([])
  const [home, setHome] = useState(null)
  const [banners, setBanners] = useState([])
  const [loading, setLoading] = useState(true)
  const [tagPosts, setTagPosts] = useState([])
  const [tagPage, setTagPage] = useState(1)
  const [tagHasMore, setTagHasMore] = useState(false)
  const [tagLoadingMore, setTagLoadingMore] = useState(false)
  const [tagTotal, setTagTotal] = useState(0)

  const pageTitle = settingText(settings.blog_page_title, 'Cẩm nang nghề nghiệp')

  useEffect(() => {
    let cancelled = false
    getBlogCategories().then((data) => { if (!cancelled) setCategories(data || []) }).catch(() => {})
    getBanners('blog_inline').then((data) => { if (!cancelled) setBanners(data || []) }).catch(() => {})
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    if (tagSlug) {
      setTagPosts([])
      setTagPage(1)
      getBlogPosts({ tag: tagSlug, page: 1, page_size: TAG_PAGE_SIZE })
        .then((res) => {
          if (cancelled) return
          setTagPosts(res.results || [])
          setTagHasMore(Boolean(res.next))
          setTagTotal(typeof res.count === 'number' ? res.count : (res.results || []).length)
          setHome(null)
        })
        .catch(() => {
          if (!cancelled) {
            setTagPosts([])
            setTagHasMore(false)
            setTagTotal(0)
          }
        })
        .finally(() => { if (!cancelled) setLoading(false) })
    } else {
      getBlogHome()
        .then((data) => { if (!cancelled) setHome(data) })
        .catch(() => { if (!cancelled) setHome({ featured: [], sections: [] }) })
        .finally(() => { if (!cancelled) setLoading(false) })
    }
    return () => { cancelled = true }
  }, [tagSlug])

  useDocumentMetadata(
    tagSlug
      ? {
          title: `Thẻ: ${tagSlug} — ${pageTitle}`,
          description: `Các bài viết cẩm nang gắn thẻ ${tagSlug}.`,
          canonicalPath: `${BLOG_ROOT}?tag=${encodeURIComponent(tagSlug)}`,
        }
      : {
          title: pageTitle,
          description: 'Kiến thức tìm việc, viết CV, phỏng vấn và phát triển sự nghiệp dành cho ứng viên.',
          canonicalPath: '/blog',
        },
  )

  async function loadMoreTagged() {
    const nextPage = tagPage + 1
    setTagLoadingMore(true)
    try {
      const res = await getBlogPosts({ tag: tagSlug, page: nextPage, page_size: TAG_PAGE_SIZE })
      setTagPosts((prev) => [...prev, ...(res.results || [])])
      setTagPage(nextPage)
      setTagHasMore(Boolean(res.next))
    } catch {
      setTagHasMore(false)
    } finally {
      setTagLoadingMore(false)
    }
  }

  const sections = home?.sections || []
  const tagLabel = tagPosts[0]?.tags?.find?.((item) => item.slug === tagSlug)?.name
    || tagSlug

  return (
    <div className="bg-white">
      {/* ── Hero banner ── */}
      <div
        style={{
          backgroundImage: `url("${legacyAsset('blog/banner-blog-procv.png')}"), linear-gradient(180deg, #065f2e 1.52%, #0e964b)`,
          backgroundPosition: 'center top, center',
          backgroundRepeat: 'no-repeat, no-repeat',
          backgroundSize: 'cover, cover',
          minHeight: '400px',
          position: 'relative',
          width: '100%',
        }}
      >
        {/* Inner container: absolute ở dưới, gradient trắng từ dưới lên */}
        <div
          style={{
            alignItems: 'center',
            background: 'linear-gradient(180deg, rgba(248,255,251,0) 8.81%, #fbfffd 57.81%)',
            bottom: 0,
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
            left: 0,
            margin: '0 auto',
            position: 'absolute',
            right: 0,
            textAlign: 'center',
            padding: '24px 16px 28px',
          }}
        >
          <h1 className="text-2xl font-extrabold text-slate-800 sm:text-3xl md:text-4xl">
            {pageTitle}
          </h1>
          <p className="max-w-2xl text-sm leading-6 text-slate-600 sm:text-base sm:leading-7">
            Khám phá thông tin hữu ích liên quan tới nghề nghiệp bạn quan tâm. Chia sẻ kinh nghiệm,
            kiến thức chuyên môn giúp bạn tìm được công việc phù hợp và phát triển bản thân.
          </p>
        </div>
      </div>

      {/* ── Category nav (sticky, dưới hero) ── */}
      <BlogCategoryNav categories={categories} />

      {/* ── Breadcrumb ── */}
      <div className="mx-auto max-w-6xl px-3 pt-4 sm:px-4 sm:pt-5">
        <nav className="flex min-w-0 items-center overflow-hidden whitespace-nowrap text-xs text-slate-400 sm:text-sm">
          <Link to="/" className="shrink-0 !text-[var(--brand-primary)] hover:!opacity-80">Trang chủ</Link>
          <span className="mx-1.5 shrink-0">›</span>
          {tagSlug ? (
            <>
              <Link to={BLOG_ROOT} className="shrink-0 !text-[var(--brand-primary)] hover:!opacity-80">{pageTitle}</Link>
              <span className="mx-1.5 shrink-0">›</span>
              <span className="truncate font-medium text-slate-900">Thẻ: {tagLabel}</span>
            </>
          ) : (
            <span className="truncate font-medium text-slate-900">{pageTitle}</span>
          )}
        </nav>
      </div>

      {loading ? (
        <HomeSkeleton />
      ) : tagSlug ? (
        <Band tone="white">
          <SectionHeading
            id="blog-tag-heading"
            title={`Thẻ: ${tagLabel}`}
            action={(
              <Link to={BLOG_ROOT} className="text-sm font-semibold text-[var(--brand-primary)] hover:underline">
                Xóa bộ lọc
              </Link>
            )}
          />
          <p className="mb-4 text-sm text-slate-500">
            {tagTotal > 0 ? `${tagTotal} bài viết` : 'Không có bài viết'}
          </p>
          {!tagPosts.length ? (
            <Empty description="Chưa có bài viết với thẻ này" />
          ) : (
            <>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {tagPosts.map((post) => (
                  <BlogCard key={post.public_id || post.slug} post={post} />
                ))}
              </div>
              {tagHasMore && (
                <div className="mt-8 flex justify-center">
                  <button
                    type="button"
                    disabled={tagLoadingMore}
                    onClick={loadMoreTagged}
                    className="inline-flex min-h-11 items-center gap-2 rounded-full border border-slate-200 bg-white px-5 text-sm font-semibold text-slate-700 transition hover:border-[var(--brand-primary)] hover:text-[var(--brand-primary)] disabled:opacity-60"
                  >
                    {tagLoadingMore ? <LoadingOutlined /> : <DownOutlined />}
                    Xem thêm
                  </button>
                </div>
              )}
            </>
          )}
        </Band>
      ) : !home?.featured?.length && !sections.length ? (
        <div className="mx-auto max-w-6xl px-4 py-16"><Empty description="Chưa có bài viết nào" /></div>
      ) : (
        <>
          <Band tone="white">
            <FeaturedPosts posts={home.featured} />
          </Band>

          {sections.map((section, index) => (
            <Fragment key={section.category.slug}>
              <Band tone={index % 2 === 0 ? 'soft' : 'white'}>
                <CategorySection category={section.category} posts={section.posts} variant={index} />
              </Band>
              {/* Chèn banner sau mỗi 2 section, xoay vòng danh sách banner. */}
              {index % 2 === 1 && banners.length > 0 && (
                <Band tone={index % 2 === 0 ? 'white' : 'soft'} tight>
                  <BlogInlineBanner banner={banners[Math.floor(index / 2) % banners.length]} />
                </Band>
              )}
            </Fragment>
          ))}
        </>
      )}
    </div>
  )
}

// Dải nền full-bleed xen kẽ trắng / xanh nhạt thương hiệu, nội dung bó max-w-6xl.
function Band({ tone = 'white', tight = false, children }) {
  const bg = tone === 'soft' ? 'bg-[var(--brand-primary-soft)]/60' : 'bg-white'
  return (
    <div className={bg}>
      <div className={`mx-auto max-w-6xl px-3 sm:px-4 ${tight ? 'py-5 sm:py-6' : 'py-6 sm:py-10'}`}>{children}</div>
    </div>
  )
}

function HomeSkeleton() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 p-4">
          <Skeleton.Image active className="!h-56 !w-full" />
          <Skeleton active paragraph={{ rows: 2 }} className="mt-4" />
        </div>
        <div className="flex flex-col gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex gap-4 rounded-2xl border border-slate-200 p-3">
              <Skeleton.Image active className="!h-24 !w-36" />
              <Skeleton active paragraph={{ rows: 1 }} className="flex-1" />
            </div>
          ))}
        </div>
      </div>
      <div className="mt-10 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-2xl border border-slate-200 p-4">
            <Skeleton.Image active className="!h-28 !w-full" />
            <Skeleton active paragraph={{ rows: 1 }} className="mt-3" />
          </div>
        ))}
      </div>
    </div>
  )
}
