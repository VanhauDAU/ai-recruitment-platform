import { useCallback, useEffect, useState } from 'react'
import { Drawer, Result, Skeleton, Tag } from 'antd'
import { Link, useParams } from 'react-router-dom'
import { BLOG_ROOT, blogCategoryPath, formatBlogDate, getBlogCategories, getBlogPost } from '@/entities/blog'
import { settingText, useSiteSettings } from '@/entities/site-settings'
import { setDocumentTitle } from '@/shared/config/document-title'
import { BlogCategoryNav } from './ui/BlogCategoryBar'
import BlogBenefits from './ui/BlogBenefits'
import BlogContent from './ui/BlogContent'
import BlogRelatedJobs from './ui/BlogRelatedJobs'
import BlogShareRail from './ui/BlogShareRail'
import BlogSidebar from './ui/BlogSidebar'
import BlogToc from './ui/BlogToc'

export default function BlogDetail() {
  const { slug } = useParams()
  const { settings } = useSiteSettings()
  const [post, setPost] = useState(null)
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [toc, setToc] = useState([])
  const [tocDrawerOpen, setTocDrawerOpen] = useState(false)

  const pageTitle = settingText(settings.blog_page_title, 'Cẩm nang nghề nghiệp')

  useEffect(() => {
    getBlogCategories().then((data) => setCategories(data || [])).catch(() => {})
  }, [])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setNotFound(false)
    setPost(null)
    setToc([])
    getBlogPost(slug)
      .then((data) => { if (!cancelled) setPost(data) })
      .catch(() => { if (!cancelled) setNotFound(true) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [slug])

  useEffect(() => {
    if (!post?.title) return undefined
    const previous = document.title
    setDocumentTitle(post.seo_title || post.title)
    return () => { setDocumentTitle(previous) }
  }, [post])

  const handleToc = useCallback((items) => setToc(items), [])

  if (loading) return <DetailSkeleton />
  if (notFound || !post) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16">
        <Result
          status="404"
          title="Không tìm thấy bài viết"
          extra={<Link to={BLOG_ROOT} className="text-[var(--brand-primary)]">Về trang {pageTitle}</Link>}
        />
      </div>
    )
  }

  return (
    <div className="bg-[#f7f9fc]">
      <BlogCategoryNav categories={categories} activeSlug={post.category?.slug} />

      <BlogBenefits />

      <div className="mx-auto max-w-6xl px-3 py-4 sm:px-4 sm:py-6">
        <nav className="flex min-w-0 items-center overflow-hidden whitespace-nowrap text-xs text-slate-400 sm:text-sm">
          <Link to="/" className="shrink-0 !text-[var(--brand-primary)] hover:!opacity-80">Trang chủ</Link>
          <span className="mx-1.5 shrink-0">›</span>
          <Link to={BLOG_ROOT} className="shrink-0 !text-[var(--brand-primary)] hover:!opacity-80">{pageTitle}</Link>
          {post.category && (
            <>
              <span className="mx-1.5 hidden shrink-0 sm:inline">›</span>
              <Link to={blogCategoryPath(post.category.slug)} className="hidden shrink-0 !text-[var(--brand-primary)] hover:!opacity-80 sm:inline">
                {post.category.name}
              </Link>
            </>
          )}
          <span className="mx-1.5 shrink-0">›</span>
          <span className="truncate font-medium text-slate-900">{post.title}</span>
        </nav>

        <div className="mt-4 lg:grid lg:grid-cols-12 lg:gap-6">
          <div className="lg:col-span-8">
            <div className="flex min-w-0 flex-col gap-3 sm:gap-4 lg:flex-row">
              <div className="max-w-full shrink-0 overflow-x-auto pb-1 lg:overflow-visible lg:pb-0">
                <BlogShareRail hasToc={toc.length > 0} onToggleToc={() => setTocDrawerOpen(true)} />
              </div>

              <article className="min-w-0 flex-1 rounded-xl border border-slate-200/80 bg-white p-4 shadow-[0_1px_3px_rgba(15,23,42,0.05)] sm:rounded-2xl sm:p-7">
                {post.category && (
                  <Link
                    to={blogCategoryPath(post.category.slug)}
                    className="text-sm font-semibold text-[var(--brand-primary)] hover:underline"
                  >
                    {post.category.name}
                  </Link>
                )}
                <h1 className="mt-1 break-words text-xl font-extrabold leading-7 text-slate-900 sm:text-3xl sm:leading-10">
                  {post.title}
                </h1>
                <p className="mt-2 text-sm text-slate-400">{formatBlogDate(post.published_at, { withTime: true })}</p>

                {toc.length > 0 && (
                  <div className="mt-5">
                    <BlogToc toc={toc} />
                  </div>
                )}

                <div className="mt-6">
                  <BlogContent html={post.content} onToc={handleToc} />
                </div>

                <BlogRelatedJobs jobCategory={post.related_job_category} />

                {post.tags?.length > 0 && (
                  <div className="mt-6 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-4">
                    <span className="text-sm font-semibold text-slate-600">Thẻ:</span>
                    {post.tags.map((tag) => (
                      <Link key={tag.slug} to={`${BLOG_ROOT}?tag=${tag.slug}`} target="_blank" rel="noopener">
                        <Tag className="cursor-pointer">{tag.name}</Tag>
                      </Link>
                    ))}
                  </div>
                )}
              </article>
            </div>
          </div>

          <div className="mt-6 lg:sticky lg:top-32 lg:col-span-4 lg:mt-0 lg:max-h-[calc(100vh-9rem)] lg:self-start lg:overflow-y-auto lg:pr-1">
            <BlogSidebar />
          </div>
        </div>
      </div>

      <Drawer
        title="Mục lục"
        placement="left"
        open={tocDrawerOpen}
        onClose={() => setTocDrawerOpen(false)}
        width="min(340px, 92vw)"
      >
        <BlogToc toc={toc} collapsible={false} onNavigate={() => setTocDrawerOpen(false)} />
      </Drawer>
    </div>
  )
}

function DetailSkeleton() {
  return (
    <div className="bg-[#f7f9fc]">
      <div className="mx-auto max-w-6xl px-4 py-6">
        <div className="rounded-2xl border border-slate-200 bg-white p-6">
          <Skeleton active paragraph={{ rows: 1 }} />
        </div>
        <div className="mt-6 lg:grid lg:grid-cols-12 lg:gap-6">
          <div className="lg:col-span-8">
            <div className="rounded-2xl border border-slate-200 bg-white p-6">
              <Skeleton active paragraph={{ rows: 2 }} />
              <Skeleton active paragraph={{ rows: 8 }} className="mt-6" />
            </div>
          </div>
          <div className="mt-8 lg:col-span-4 lg:mt-0">
            <div className="rounded-2xl border border-slate-200 bg-white p-6">
              <Skeleton active paragraph={{ rows: 4 }} />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
