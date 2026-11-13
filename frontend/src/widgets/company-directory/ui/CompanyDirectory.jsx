import {
  BankOutlined,
  ReloadOutlined,
} from '@ant-design/icons'
import { useEffect, useRef } from 'react'
import { useCompanyDirectory } from '../model/use-company-directory'
import CompanyCard from './CompanyCard'
import { CompanyDirectoryHero, CompanySearchHeader } from './CompanyDirectoryHero'
import SearchCompanyCard from './SearchCompanyCard'
import TopEmployersSidebar from './TopEmployersSidebar'
import '../company-directory.css'

const FEATURED_SKELETON_COUNT = 9
const SEARCH_SKELETON_COUNT = 5
const NEXT_SKELETON_COUNT = 3

function CompanyCardSkeleton() {
  return (
    <div className="min-h-[390px] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm" aria-hidden="true">
      <div className="company-directory-cover aspect-[32/15] motion-safe:animate-pulse bg-slate-100" />
      <div className="relative px-5 pb-5 pt-11">
        <div className="absolute -top-8 left-5 h-16 w-16 rounded-xl border border-slate-200 bg-white p-1 shadow-sm sm:h-[72px] sm:w-[72px]">
          <div className="h-full w-full motion-safe:animate-pulse rounded-lg bg-slate-100" />
        </div>
        <div className="h-5 w-4/5 motion-safe:animate-pulse rounded bg-slate-100" />
        <div className="mt-3 h-6 w-28 motion-safe:animate-pulse rounded-full bg-emerald-50" />
        <div className="mt-4 space-y-2">
          <div className="h-3 w-full motion-safe:animate-pulse rounded bg-slate-100" />
          <div className="h-3 w-full motion-safe:animate-pulse rounded bg-slate-100" />
          <div className="h-3 w-2/3 motion-safe:animate-pulse rounded bg-slate-100" />
        </div>
      </div>
    </div>
  )
}

function SearchCompanyCardSkeleton() {
  return (
    <div className="flex min-h-28 gap-2.5 rounded-lg border border-slate-200 bg-white p-2.5 shadow-sm sm:p-3" aria-hidden="true">
      <div className="h-14 w-14 shrink-0 motion-safe:animate-pulse rounded-lg bg-slate-100 sm:h-16 sm:w-16" />
      <div className="min-w-0 flex-1">
        <div className="h-4 w-3/5 motion-safe:animate-pulse rounded bg-slate-100" />
        <div className="mt-1 h-3 w-32 motion-safe:animate-pulse rounded bg-emerald-50" />
        <div className="mt-2 h-3 w-2/5 motion-safe:animate-pulse rounded bg-slate-100" />
        <div className="mt-1.5 h-2.5 w-full motion-safe:animate-pulse rounded bg-slate-100" />
        <div className="mt-1.5 h-2.5 w-4/5 motion-safe:animate-pulse rounded bg-slate-100" />
      </div>
    </div>
  )
}

function InitialError({ isSearch, onRetry }) {
  return (
    <div className="rounded-xl border border-red-100 bg-white px-5 py-10 text-center shadow-sm" role="alert">
      <p className="text-lg font-bold text-slate-900">
        {isSearch ? 'Không thể tải kết quả tìm kiếm' : 'Không thể tải công ty nổi bật'}
      </p>
      <p className="mt-2 text-sm text-slate-500">Kết nối đang gặp sự cố. Vui lòng thử lại.</p>
      <button type="button" onClick={onRetry} className="mt-5 inline-flex items-center gap-2 rounded-lg border border-emerald-200 px-5 py-2.5 text-sm font-bold text-emerald-700 transition hover:border-emerald-500 hover:bg-emerald-50">
        <ReloadOutlined /> Thử lại
      </button>
    </div>
  )
}

function EmptyState() {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-6 py-14 text-center shadow-sm">
      <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50 text-2xl text-emerald-600" aria-hidden="true"><BankOutlined /></span>
      <h3 className="mt-4 text-lg font-bold text-slate-900">Chưa có công ty nổi bật</h3>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
        Chưa có doanh nghiệp đáp ứng điều kiện hiển thị nổi bật.
      </p>
    </div>
  )
}

export default function CompanyDirectory({
  featuredRequestKey = 0,
  query = '',
  mode = query ? 'search' : 'featured',
  onQueryChange,
}) {
  const sentinelRef = useRef(null)
  const {
    companies,
    featuredCompanies,
    fetchNextPage,
    hasSearchKeyword,
    hasNextPage,
    isError,
    isFeaturedError,
    isFeaturedPending,
    isFetchNextPageError,
    isFetchingNextPage,
    isPending,
    isSearch,
    refetch,
    refetchFeatured,
    totalCount,
  } = useCompanyDirectory(query, { featuredRequestKey, mode })

  useEffect(() => {
    const sentinel = sentinelRef.current
    if (!isSearch || !sentinel || !hasNextPage || typeof IntersectionObserver === 'undefined') return undefined

    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !isFetchingNextPage) fetchNextPage()
    }, { rootMargin: '700px 0px' })
    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [fetchNextPage, hasNextPage, isFetchingNextPage, isSearch])

  const initialError = isError && companies.length === 0
  const featuredEmpty = !isSearch && !isPending && !initialError && companies.length === 0
  const searchHasNoResults = isSearch
    && hasSearchKeyword
    && !isPending
    && !initialError
    && totalCount === 0
    && companies.length === 0
  const showDirectorySection = !isSearch || (hasSearchKeyword && !searchHasNoResults)
  const searchStatus = !hasSearchKeyword
    ? ''
    : isPending
      ? 'Đang tìm công ty phù hợp với yêu cầu của bạn.'
      : initialError
        ? 'Không thể tải kết quả tìm kiếm.'
        : totalCount === 0
          ? 'Không tìm thấy công ty phù hợp với yêu cầu của bạn.'
          : Number.isFinite(totalCount)
            ? `Tìm thấy ${totalCount.toLocaleString('vi-VN')} công ty phù hợp với yêu cầu của bạn.`
            : ''

  return (
    <div className={`min-h-screen ${isSearch ? 'bg-[#f5f7f8]' : 'bg-white'}`}>
      {isSearch
        ? <CompanySearchHeader query={query} onQueryChange={onQueryChange} />
        : <CompanyDirectoryHero query={query} onQueryChange={onQueryChange} />}

      {isSearch && (
        <p
          className="sr-only"
          role="status"
          aria-live="polite"
          aria-atomic="true"
          data-testid="company-search-status"
        >
          {searchStatus}
        </p>
      )}

      {showDirectorySection && (
        <section aria-labelledby="company-directory-title" className="mx-auto max-w-7xl px-4 pb-10 pt-5 sm:px-6 sm:pb-12 sm:pt-6 lg:px-8">
          {isSearch ? (
            <div className="grid min-w-0 gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)] lg:items-start">
              <div className="min-w-0 rounded-xl border border-slate-200 bg-white p-3 shadow-sm" data-testid="company-search-results">
                <h2 id="company-directory-title" className="mb-2.5 text-sm font-normal text-slate-700 sm:text-base">
                  {Number.isFinite(totalCount)
                    ? (
                        <>Tìm thấy <span className="text-[var(--brand-primary)]">{totalCount.toLocaleString('vi-VN')}</span> công ty phù hợp với yêu cầu của bạn</>
                      )
                    : 'Đang tìm công ty phù hợp với yêu cầu của bạn'}
                </h2>

                {isPending && (
                  <div className="grid gap-2.5" aria-label="Đang tải kết quả tìm kiếm">
                    {Array.from({ length: SEARCH_SKELETON_COUNT }, (_, index) => <SearchCompanyCardSkeleton key={index} />)}
                  </div>
                )}

                {initialError && <InitialError isSearch onRetry={refetch} />}

                {companies.length > 0 && (
                  <>
                    <div className="grid gap-2.5" data-testid="company-search-list">
                      {companies.map((company) => (
                        <SearchCompanyCard key={company.public_id} company={company} />
                      ))}
                      {isFetchingNextPage && Array.from(
                        { length: NEXT_SKELETON_COUNT },
                        (_, index) => <SearchCompanyCardSkeleton key={`next-${index}`} />,
                      )}
                    </div>

                    <div ref={sentinelRef} className="mt-6 flex min-h-12 items-center justify-center" aria-live="polite">
                      {hasNextPage && !isFetchNextPageError && (
                        <button
                          type="button"
                          onClick={() => fetchNextPage()}
                          disabled={isFetchingNextPage}
                          className="rounded-full border border-emerald-200 bg-white px-6 py-2.5 text-sm font-bold text-emerald-700 shadow-sm transition hover:border-emerald-500 hover:bg-emerald-50 disabled:cursor-wait disabled:opacity-60"
                        >
                          {isFetchingNextPage ? 'Đang tải thêm công ty…' : 'Tải thêm công ty'}
                        </button>
                      )}
                      {isFetchNextPageError && (
                        <button type="button" onClick={() => fetchNextPage()} className="inline-flex items-center gap-2 rounded-full border border-red-200 bg-white px-6 py-2.5 text-sm font-bold text-red-700 shadow-sm hover:bg-red-50">
                          <ReloadOutlined /> Thử tải lại
                        </button>
                      )}
                      {!hasNextPage && !isFetchingNextPage && (
                        <p className="text-sm text-slate-500">Bạn đã xem hết kết quả tìm kiếm.</p>
                      )}
                    </div>
                  </>
                )}
              </div>

              <TopEmployersSidebar
                companies={featuredCompanies}
                isError={isFeaturedError}
                isPending={isFeaturedPending}
                onRetry={refetchFeatured}
              />
            </div>
          ) : (
            <>
              <h2 id="company-directory-title" className="mb-5 text-center text-base font-bold uppercase tracking-wide text-slate-800 sm:text-lg">
                Danh sách các công ty nổi bật
              </h2>

              {isPending && (
                <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3" aria-label="Đang tải công ty nổi bật">
                  {Array.from({ length: FEATURED_SKELETON_COUNT }, (_, index) => <CompanyCardSkeleton key={index} />)}
                </div>
              )}

              {initialError && <InitialError isSearch={false} onRetry={refetch} />}
              {featuredEmpty && <EmptyState />}

              {companies.length > 0 && (
                <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                  {companies.map((company, index) => (
                    <CompanyCard key={company.public_id} company={company} eager={index < 3} />
                  ))}
                </div>
              )}
            </>
          )}
        </section>
      )}
    </div>
  )
}
