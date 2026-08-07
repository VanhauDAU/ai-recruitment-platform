import { lazy, Suspense, useCallback, useEffect, useState } from 'react'
import { Drawer, Result, Skeleton, Tag } from 'antd'
import { Link, useParams } from 'react-router'
import { BLOG_ROOT, BlogPostContent, blogCategoryPath, formatBlogDate, getBlogCategories, getBlogPost } from '@/entities/blog'
import { settingText, useSiteSettings } from '@/entities/site-settings'
import { useDocumentMetadata } from '@/shared/hooks/use-document-metadata'
import { BlogCategoryNav } from './ui/BlogCategoryBar'
import BlogBenefits from './ui/BlogBenefits'
import BlogRelatedJobs from './ui/BlogRelatedJobs'
import BlogRelatedPosts from './ui/BlogRelatedPosts'
import BlogShareRail from './ui/BlogShareRail'
import BlogSidebar from './ui/BlogSidebar'
import BlogToc from './ui/BlogToc'

const BlogSpeechPlayer = lazy(() => import('@/features/listen-to-blog-post').then(
  ({ BlogSpeechPlayer: Component }) => ({ default: Component }),
))

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

  const canonicalPath = post ? `/blog/${post.slug}` : null
  const shareTitle = post ? (post.seo_title || post.title) : ''
  const shareDescription = post
    ? (post.seo_description || post.summary || settings.seo_default_description)
    : ''

  useDocumentMetadata(
    post
      ? {
          title: shareTitle,
          description: shareDescription,
          canonicalPath,
          imageUrl: post.thumbnail_url,
          pageType: 'article',
          // Khớp route public indexable; crawler FB/X chủ yếu đọc SEO shell server.
          robots: settings.seo_robots_index === false ? 'noindex, nofollow' : 'index, follow',
          structuredData: {
            '@context': 'https://schema.org',
            '@type': 'Article',
            headline: post.title,
            description: post.seo_description || post.summary,
            datePublished: post.published_at,
            author: { '@type': 'Person', name: post.author?.name || 'Biên tập ProCV' },
            image: post.thumbnail_url
              ? new URL(post.thumbnail_url, window.location.origin).href
              : undefined,
            mainEntityOfPage: new URL(canonicalPath, window.location.origin).href,
          },
        }
      : null,
  )

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

  const readingLabel = post.reading_time_minutes
    ? `${post.reading_time_minutes} phút đọc`
    : null
  const authorName = post.author?.name || 'Biên tập ProCV'

  return (
    <div className="bg-[#f7f9fc] pb-24 sm:pb-10">
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
              <div className="max-w-full shrink-0 pb-1 lg:pb-0">
                <BlogShareRail
                  hasToc={toc.length > 0}
                  onToggleToc={() => setTocDrawerOpen(true)}
                  sharePath={canonicalPath}
                  title={shareTitle}
                  description={shareDescription}
                  speechControl={(
                    <Suspense fallback={<SpeechPlayerSkeleton />}>
                      <BlogSpeechPlayer
                        defaultAsset={post.speech_default}
                        postPublicId={post.public_id}
                      />
                    </Suspense>
                  )}
                />
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
                <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-slate-400">
                  <span>{formatBlogDate(post.published_at, { withTime: true })}</span>
                  {readingLabel && (
                    <>
                      <span aria-hidden="true">·</span>
                      <span>{readingLabel}</span>
                    </>
                  )}
                  <span aria-hidden="true">·</span>
                  <span>{authorName}</span>
                </p>

                {toc.length > 0 && (
                  <div className="mt-5">
                    <BlogToc toc={toc} />
                  </div>
                )}

                <div className="mt-6">
                  <BlogPostContent html={post.content} onToc={handleToc} />
                </div>

                <BlogRelatedJobs jobCategory={post.related_job_category} />

                {post.tags?.length > 0 && (
                  <div className="mt-6 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-4">
                    <span className="text-sm font-semibold text-slate-600">Thẻ:</span>
                    {post.tags.map((tag) => (
                      <Link
                        key={tag.slug}
                        to={`${BLOG_ROOT}?tag=${encodeURIComponent(tag.slug)}`}
                        className="!text-inherit no-underline"
                      >
                        <Tag className="m-0 cursor-pointer !border-slate-200 !bg-slate-50 !text-slate-700 hover:!border-[var(--brand-primary)] hover:!bg-[var(--brand-primary-soft)] hover:!text-[var(--brand-primary)]">
                          {tag.name}
                        </Tag>
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

        {/* Full-bleed dưới lưới 8+4: section riêng, 12 cột, 3 bài / hàng */}
        {post.related_posts?.length > 0 && (
          <div className="mt-8 sm:mt-10">
            <BlogRelatedPosts posts={post.related_posts} category={post.category} />
          </div>
        )}
      </div>

      <Drawer
        title="Mục lục"
        placement="left"
        open={tocDrawerOpen}
        onClose={() => setTocDrawerOpen(false)}
        size="min(340px, 92vw)"
      >
        <BlogToc toc={toc} collapsible={false} onNavigate={() => setTocDrawerOpen(false)} />
      </Drawer>
    </div>
  )
}

function SpeechPlayerSkeleton() {
  return (
    <div
      className="h-12 w-12 animate-pulse rounded-full border border-emerald-100 bg-emerald-50/70"
      aria-hidden="true"
    />
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
