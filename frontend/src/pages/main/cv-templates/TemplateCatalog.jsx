import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { Empty, Skeleton, Spin } from 'antd'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router'
import {
  CvTemplateCard,
  getCvCategories,
  getCvTemplates,
} from '@/entities/cv-template'
import { UseTemplateModal } from '@/features/create-cv-from-template'
import { useLoginPrompt } from '@/features/auth'
import { useDocumentMetadata } from '@/shared/hooks/use-document-metadata'
import {
  catalogCategoryFromPath,
  CATALOG_LOCALES,
  catalogLocaleFromPath,
  catalogPathForCategory,
  catalogPathForLocale,
} from './locale-paths'
import CatalogFilterBar from './ui/CatalogFilterBar'
import CatalogHeader from './ui/CatalogHeader'
import LayoutFilters from './ui/LayoutFilters'

const CATALOG_STALE_MS = 60_000

const PHOTO_PARAMS = { co: '1', khong: '0' }

export default function TemplateCatalog() {
  const navigate = useNavigate()
  const { promptLogin } = useLoginPrompt()
  const { pathname } = useLocation()
  const [params, setParams] = useSearchParams()
  const { locale, shortLabel: localeLabel, path: basePath } = catalogLocaleFromPath(pathname)
  const [selection, setSelection] = useState(null)
  const sentinelRef = useRef(null)
  const layoutFilter = { anh: PHOTO_PARAMS[params.get('anh')] ? params.get('anh') : null, cot: ['1', '2'].includes(params.get('cot')) ? params.get('cot') : null }

  const categoriesQuery = useQuery({ queryKey: ['cv-categories'], queryFn: getCvCategories, staleTime: CATALOG_STALE_MS })
  const categories = useMemo(() => categoriesQuery.data || [], [categoriesQuery.data])
  const categorySlug = catalogCategoryFromPath(pathname, basePath)
  const activeCategory = categories.find((category) => category.slug === categorySlug) || null
  const filter = {
    ...(activeCategory ? (activeCategory.category_type === 'feature' ? { tag: activeCategory.slug } : { category: activeCategory.slug }) : {}),
    ...(layoutFilter.anh ? { has_photo: PHOTO_PARAMS[layoutFilter.anh] } : {}),
    ...(layoutFilter.cot ? { columns: layoutFilter.cot } : {}),
  }
  // Có slug danh mục trên URL thì chờ danh sách danh mục để lọc đúng ngay lần đầu.
  const waitingCategory = Boolean(categorySlug) && categoriesQuery.isPending
  const templatesQuery = useInfiniteQuery({
    queryKey: ['cv-templates', locale, filter],
    queryFn: ({ pageParam }) => getCvTemplates({ locale, page: pageParam, ...filter }),
    initialPageParam: 1,
    getNextPageParam: (lastPage, pages) => (lastPage.next ? pages.length + 1 : undefined),
    enabled: !waitingCategory,
    staleTime: CATALOG_STALE_MS,
  })
  const templates = useMemo(() => (templatesQuery.data?.pages || []).flatMap((page) => page.results), [templatesQuery.data])
  const count = templatesQuery.data?.pages[0]?.count ?? templates.length
  const loading = waitingCategory || templatesQuery.isPending
  const { hasNextPage, isFetchingNextPage, fetchNextPage } = templatesQuery

  useDocumentMetadata(
    {
      title: activeCategory
        ? `${activeCategory.name} - Mẫu CV ${localeLabel}`
        : `Mẫu CV ${localeLabel} chuyên nghiệp`,
      description: activeCategory
        ? `Khám phá mẫu CV ${localeLabel} ${activeCategory.name}, dễ chỉnh sửa và dùng ngay.`
        : `Khám phá mẫu CV ${localeLabel} chuyên nghiệp, dễ chỉnh sửa và phù hợp nhiều ngành nghề.`,
      canonicalPath: activeCategory
        ? catalogPathForCategory(basePath, activeCategory.slug)
        : basePath,
      ...(params.toString() ? { robots: 'noindex, follow' } : {}),
    },
  )

  // Cuộn vô hạn: tải trang kế khi gần chạm cuối danh sách.
  useEffect(() => {
    const sentinel = sentinelRef.current
    if (!sentinel || !hasNextPage) return undefined
    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && !isFetchingNextPage) fetchNextPage()
    }, { rootMargin: '400px' })
    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [hasNextPage, isFetchingNextPage, fetchNextPage])

  const setLayoutFilter = (key, value) => setParams((current) => {
    const next = new URLSearchParams(current)
    if (value) next.set(key, value)
    else next.delete(key)
    return next
  }, { replace: true })

  // Khi người dùng chọn filter → cập nhật URL và reset page
  const selectFilter = (category) => {
    navigate({ pathname: catalogPathForCategory(basePath, category?.slug || null), search: params.toString() }, { replace: true })
  }

  // Khi đổi ngôn ngữ → navigate đến basePath ngôn ngữ mới (giữ category slug nếu có)
  const changeLocale = (nextLocale) => {
    if (nextLocale === locale) return
    const newBase = catalogPathForLocale(nextLocale)
    navigate({ pathname: catalogPathForCategory(newBase, activeCategory?.slug || null), search: params.toString() }, { replace: true })
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
          <div className="mt-4"><LayoutFilters value={layoutFilter} onChange={setLayoutFilter} /></div>
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
                {isFetchingNextPage && <Spin />}
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
        onCreated={(cv) => navigate(`/cvs/${cv.public_id}/edit?mode=create`)}
        locale={locale}
        onRequireLogin={promptLogin}
      />
    </div>
  )
}
