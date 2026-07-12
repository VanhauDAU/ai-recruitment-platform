import { Fragment, useEffect, useState } from 'react'
import { Empty, Skeleton } from 'antd'
import { Link } from 'react-router-dom'
import { getBanners } from '@/api/siteService'
import { getBlogCategories, getBlogHome } from '@/api/blogService'
import { settingText, useSiteSettings } from '@/hooks/useSiteSettings'
import { BlogCategoryNav } from './components/BlogCategoryBar'
import BlogInlineBanner from './components/BlogInlineBanner'
import CategorySection from './components/CategorySection'
import FeaturedPosts from './components/FeaturedPosts'

// Trang /blog kiểu magazine: khối nổi bật + mỗi danh mục một section (bố cục
// xoay vòng, nền xen kẽ), banner "ảnh giả button" chèn giữa các section.
export default function BlogHome() {
  const { settings } = useSiteSettings()
  const [categories, setCategories] = useState([])
  const [home, setHome] = useState(null)
  const [banners, setBanners] = useState([])
  const [loading, setLoading] = useState(true)

  const pageTitle = settingText(settings.blog_page_title, 'Cẩm nang nghề nghiệp')

  useEffect(() => {
    let cancelled = false
    getBlogCategories().then((data) => { if (!cancelled) setCategories(data || []) }).catch(() => {})
    getBanners('blog_inline').then((data) => { if (!cancelled) setBanners(data || []) }).catch(() => {})
    getBlogHome()
      .then((data) => { if (!cancelled) setHome(data) })
      .catch(() => { if (!cancelled) setHome({ featured: [], sections: [] }) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  useEffect(() => { document.title = pageTitle }, [pageTitle])

  const sections = home?.sections || []

  return (
    <div className="bg-white">
      <BlogCategoryNav categories={categories} />

      <div className="mx-auto max-w-6xl px-3 pt-4 sm:px-4 sm:pt-5">
        <nav className="flex min-w-0 items-center overflow-hidden whitespace-nowrap text-xs text-slate-400 sm:text-sm">
          <Link to="/" className="shrink-0 hover:text-[var(--brand-primary)]">Trang chủ</Link>
          <span className="mx-1.5 shrink-0">›</span>
          <span className="truncate font-medium text-[var(--brand-primary)]">{pageTitle}</span>
        </nav>
        <h1 className="mt-2 text-xl font-extrabold text-slate-900 sm:text-3xl">{pageTitle}</h1>
      </div>

      {loading ? (
        <HomeSkeleton />
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
