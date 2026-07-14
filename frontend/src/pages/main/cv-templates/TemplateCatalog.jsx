import { Empty, Skeleton, Spin } from 'antd'
import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  CvTemplateCard,
  getCvCategories,
  getCvTemplates,
} from '@/entities/cv-template'
import { UseTemplateModal } from '@/features/create-cv-from-template'
import {
  CATALOG_LOCALES,
  catalogCategoryFromPath,
  catalogLocaleFromPath,
  catalogPathForCategory,
  catalogPathForLocale,
} from './locale-paths'
import CatalogFilterBar from './ui/CatalogFilterBar'
import CatalogHeader from './ui/CatalogHeader'

export default function TemplateCatalog() {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const { locale, shortLabel: localeLabel, path: basePath } = catalogLocaleFromPath(pathname)

  const [templates, setTemplates] = useState([])
  const [count, setCount] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [page, setPage] = useState(1)
  const [categories, setCategories] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [activeCategory, setActiveCategory] = useState(null)
  const [selection, setSelection] = useState(null)
  const sentinelRef = useRef(null)

  // Load danh mục từ API một lần
  useEffect(() => {
    let cancelled = false
    getCvCategories()
      .then((data) => !cancelled && setCategories(data))
      .catch(() => !cancelled && setCategories([]))
    return () => { cancelled = true }
  }, [])

  // Đồng bộ activeCategory từ URL khi categories đã có
  useEffect(() => {
    if (!categories.length) return
    const slugFromUrl = catalogCategoryFromPath(pathname, basePath)
    if (!slugFromUrl) {
      setActiveCategory(null)
      return
    }
    const found = categories.find((c) => c.slug === slugFromUrl)
    setActiveCategory(found || null)
  }, [categories, pathname, basePath])

  // Load templates khi locale / activeCategory / page thay đổi
  useEffect(() => {
    let cancelled = false
    const isFirstPage = page === 1
    if (isFirstPage) setLoading(true)
    else setLoadingMore(true)
    const filter = activeCategory
      ? (activeCategory.category_type === 'feature'
        ? { tag: activeCategory.slug }
        : { category: activeCategory.slug })
      : {}
    getCvTemplates({ locale, page, ...filter })
      .then((data) => {
        if (cancelled) return
        setTemplates((current) => (isFirstPage ? data.results : [...current, ...data.results]))
        setCount(data.count ?? data.results.length)
        setHasMore(Boolean(data.next))
      })
      .catch(() => {
        if (cancelled) return
        if (isFirstPage) setTemplates([])
        setHasMore(false)
      })
      .finally(() => {
        if (cancelled) return
        setLoading(false)
        setLoadingMore(false)
      })
    return () => { cancelled = true }
  }, [locale, activeCategory, page])

  useEffect(() => { document.title = 'Mẫu CV chuyên nghiệp | ProCV' }, [])

  // Infinite scroll
  useEffect(() => {
    const sentinel = sentinelRef.current
    if (!sentinel || !hasMore) return undefined
    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && !loading && !loadingMore) setPage((current) => current + 1)
    }, { rootMargin: '400px' })
    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [hasMore, loading, loadingMore])

  // Khi người dùng chọn filter → cập nhật URL và reset page
  const selectFilter = (category) => {
    setActiveCategory(category)
    setPage(1)
    navigate(catalogPathForCategory(basePath, category?.slug || null), { replace: true })
  }

  // Khi đổi ngôn ngữ → navigate đến basePath ngôn ngữ mới (giữ category slug nếu có)
  const changeLocale = (nextLocale) => {
    if (nextLocale === locale) return
    const newBase = catalogPathForLocale(nextLocale)
    navigate(catalogPathForCategory(newBase, activeCategory?.slug || null), { replace: true })
  }

  const year = new Date().getFullYear()
  const subtitle = loading
    ? 'Đang tải các mẫu CV phù hợp…'
    : `Tuyển chọn ${count} mẫu CV đa dạng phong cách, giúp bạn tạo dấu ấn cá nhân và kết nối mạnh mẽ hơn với nhà tuyển dụng.`

  const gridClass = 'grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 lg:gap-8'

  return (
    <div className="min-h-[calc(100vh-8rem)] bg-[#f4f6f8]">
      <div className="mx-auto max-w-[1280px] px-4 py-10 md:py-12">
        <CatalogHeader
          activeCategory={activeCategory}
          localeLabel={localeLabel}
          year={year}
          subtitle={subtitle}
        />

        <div className="mt-8 md:mt-10">
          <CatalogFilterBar
            categories={categories}
            activeSlug={activeCategory?.slug || null}
            onSelect={selectFilter}
            locale={locale}
            localeOptions={CATALOG_LOCALES}
            onLocaleChange={changeLocale}
          />
        </div>

        <div className="mt-8">
          {loading ? (
            <div className={gridClass}>
              {Array.from({ length: 8 }).map((_, index) => (
                <div key={index} className="rounded-xl bg-white p-3 shadow-sm">
                  <Skeleton.Image active className="!aspect-[3/4] !h-auto !w-full !rounded-lg" />
                  <Skeleton active title={false} paragraph={{ rows: 1, width: '60%' }} className="mt-3" />
                </div>
              ))}
            </div>
          ) : templates.length === 0 ? (
            <div className="py-16">
              <Empty description="Không tìm thấy mẫu CV phù hợp với bộ lọc này." />
            </div>
          ) : (
            <>
              <div className={gridClass}>
                {templates.map((template) => (
                  <CvTemplateCard
                    key={template.public_id}
                    template={template}
                    detailBasePath={basePath}
                    onUse={(tpl, color) => setSelection({ template: tpl, color })}
                  />
                ))}
              </div>
              <div ref={sentinelRef} className="flex justify-center py-6">
                {loadingMore && <Spin />}
              </div>
            </>
          )}
        </div>
      </div>

      <UseTemplateModal
        template={selection?.template || null}
        themeColor={selection?.color}
        open={Boolean(selection)}
        onClose={() => setSelection(null)}
        onCreated={(cv) => navigate(`/cvs/${cv.public_id}/edit`)}
        locale={locale}
      />
    </div>
  )
}
