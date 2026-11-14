import { useQuery } from '@tanstack/react-query'
import { Suspense, useEffect, useRef } from 'react'
import { Link } from 'react-router'
import {
  COMPANY_DIRECTORY_PATH,
  COMPANY_JOBS_TAB,
  companyDetailPath,
  companyKeys,
  CompanyProfileView,
  getSimilarCompanies,
  usePublicCompany,
} from '@/entities/company'
import { CompanyJobsPreview, CompanyJobsTab } from './CompanyJobs'
import {
  CompanyProfileError,
  CompanyProfileNotFound,
  CompanyProfileSkeleton,
} from './CompanyProfileStates'
import SimilarCompanies from './SimilarCompanies'
import '../public-company-profile.css'

const BREADCRUMB_LINK = 'shrink-0 font-medium !text-slate-700 transition-colors hover:!text-[var(--brand-primary)]'
const PRIMARY_LINK = 'items-center justify-center gap-2 rounded-lg !bg-[var(--brand-primary)] text-sm font-bold !text-white shadow-sm transition hover:!bg-[var(--brand-primary-hover)]'
const SIMILAR_SKELETON = (
  <div className="space-y-3" aria-label="Đang tải công ty cùng lĩnh vực">
    {[0, 1, 2].map((index) => (
      <div key={index} className="h-12 motion-safe:animate-pulse rounded-lg bg-slate-100" aria-hidden="true" />
    ))}
  </div>
)

function CompanyTabs({ ref, slug, isJobsTab, jobCount }) {
  const tabs = [
    { label: 'Tổng quan', to: companyDetailPath(slug), current: !isJobsTab },
    {
      label: `Việc làm (${jobCount.toLocaleString('vi-VN')})`,
      to: companyDetailPath(slug, { tab: COMPANY_JOBS_TAB }),
      current: isJobsTab,
    },
  ]
  return (
    <nav ref={ref} aria-label="Nội dung trang công ty" className="company-profile-tabs">
      {tabs.map((tab) => (
        <Link key={tab.to} to={tab.to} aria-current={tab.current ? 'page' : undefined} className="company-profile-tab">
          {tab.label}
        </Link>
      ))}
    </nav>
  )
}

/** `actions` là chỗ gắn nút theo dõi ở các giai đoạn sau, đứng trước nút xem việc làm. */
function CompanyMobileCta({ actions, jobCount, to }) {
  useEffect(() => {
    // Nút nổi (góp ý, trợ lý) tự nâng lên khỏi thanh này nhờ class trên body.
    document.body.classList.add('has-bottom-action-bar')
    return () => document.body.classList.remove('has-bottom-action-bar')
  }, [])

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-gray-200 bg-white/95 p-3 shadow-[0_-8px_24px_rgba(15,23,42,0.08)] backdrop-blur lg:hidden">
      <div className="mx-auto flex max-w-6xl gap-2">
        {actions}
        <Link to={to} className={`inline-flex h-11 flex-1 px-4 ${PRIMARY_LINK}`}>
          Xem việc làm ({jobCount.toLocaleString('vi-VN')})
        </Link>
      </div>
    </div>
  )
}

function CompanyProfilePage({ profile, tab, q, location, page }) {
  const tabsRef = useRef(null)
  const isJobsTab = tab === COMPANY_JOBS_TAB
  const view = `${tab}|${q}|${location}|${page}`
  const lastView = useRef(view)
  const jobCount = Number(profile.stats?.active_public_job_count) || 0
  const jobsPath = companyDetailPath(profile.slug, { tab: COMPANY_JOBS_TAB })
  const similarQuery = useQuery({
    queryKey: companyKeys.similar(profile.public_id),
    queryFn: ({ signal }) => getSimilarCompanies(profile.public_id, { signal }),
    enabled: (profile.sidebar || []).some((block) => block.type === 'similar_companies'),
    staleTime: 5 * 60_000,
  })
  const similarCompanies = similarQuery.data?.results || []

  // Mọi thay đổi URL đều đưa trang về đầu. Trong tab việc làm, người dùng vừa
  // đổi tab, bộ lọc hoặc trang nên đưa thẳng thanh tab lên thay vì hero.
  useEffect(() => {
    if (lastView.current === view) return
    lastView.current = view
    if (isJobsTab) tabsRef.current?.scrollIntoView?.({ block: 'start' })
  }, [isJobsTab, view])

  return (
    <>
      <main className="bg-[#f5f7f8] pb-24 pt-5 lg:pb-10">
        <div className="mx-auto max-w-6xl px-4">
          <nav aria-label="Breadcrumb" className="mb-4 flex min-w-0 items-center gap-2 overflow-hidden whitespace-nowrap text-xs text-gray-500 sm:text-sm">
            <Link to="/" className={BREADCRUMB_LINK}>Trang chủ</Link>
            <span className="text-gray-300" aria-hidden="true">›</span>
            <Link to={COMPANY_DIRECTORY_PATH} className={BREADCRUMB_LINK}>Công ty</Link>
            <span className="text-gray-300" aria-hidden="true">›</span>
            <span className="truncate font-medium text-slate-700">{profile.identity.display_name}</span>
          </nav>

          <CompanyProfileView
            profile={profile}
            heroActions={jobCount > 0 && !isJobsTab && (
              <Link to={jobsPath} className={`hidden h-11 px-5 lg:inline-flex ${PRIMARY_LINK}`}>
                Xem việc làm
              </Link>
            )}
            navigation={(
              <CompanyTabs ref={tabsRef} slug={profile.slug} isJobsTab={isJobsTab} jobCount={jobCount} />
            )}
            focusType={isJobsTab ? 'jobs' : undefined}
            slots={{
              jobs: isJobsTab
                ? <CompanyJobsTab company={profile} q={q} location={location} page={page} />
                : <CompanyJobsPreview company={profile} jobsPath={jobsPath} />,
              similar_companies: similarQuery.isPending
                ? SIMILAR_SKELETON
                : similarCompanies.length > 0 && <SimilarCompanies companies={similarCompanies} />,
            }}
          />
        </div>
      </main>

      {jobCount > 0 && !isJobsTab && <CompanyMobileCta jobCount={jobCount} to={jobsPath} />}
    </>
  )
}

/** Trang công ty công khai: `tab`, `q`, `location`, `page` là trạng thái URL do page đọc. */
export default function PublicCompanyProfile({ slug, tab = '', q = '', location = '', page = 1 }) {
  const { profile, isPending, isNotFound, isError, refetch } = usePublicCompany(slug)

  if (isPending) return <CompanyProfileSkeleton />
  if (isNotFound) return <CompanyProfileNotFound />
  // Payload thiếu `identity` là sai contract: báo lỗi thay vì để cả trang vỡ.
  if (isError || !profile?.identity) return <CompanyProfileError onRetry={refetch} />

  // CompanyProfileView là lazy chunk của entity; khung chờ giữ nguyên bố cục.
  return (
    <Suspense fallback={<CompanyProfileSkeleton />}>
      <CompanyProfilePage profile={profile} tab={tab} q={q} location={location} page={page} />
    </Suspense>
  )
}
