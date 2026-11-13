import { ReloadOutlined } from '@ant-design/icons'
import { Link } from 'react-router'
import { companyJobsPath } from '@/entities/company'
import CompanyLogo from './CompanyLogo'
import { companyDisplayName } from './company-presentation'

const SIDEBAR_SKELETON_COUNT = 6

export default function TopEmployersSidebar({
  companies,
  isError,
  isPending,
  onRetry,
}) {
  return (
    <aside data-testid="top-employers-sidebar" aria-labelledby="top-employers-title" className="min-w-0 self-start rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <h2 id="top-employers-title" className="text-lg font-extrabold text-slate-900">
        Nhà tuyển dụng hàng đầu
      </h2>

      {isPending && (
        <div className="mt-4 grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-2" aria-label="Đang tải nhà tuyển dụng hàng đầu">
          {Array.from({ length: SIDEBAR_SKELETON_COUNT }, (_, index) => (
            <span key={index} className="aspect-square motion-safe:animate-pulse rounded-2xl border border-slate-100 bg-slate-50" aria-hidden="true" />
          ))}
        </div>
      )}

      {!isPending && isError && (
        <div className="mt-4 rounded-xl bg-slate-50 px-3 py-4 text-center">
          <p className="text-sm text-slate-500">Chưa thể tải danh sách nổi bật.</p>
          <button type="button" onClick={onRetry} className="mt-3 inline-flex items-center gap-1.5 text-sm font-bold text-emerald-700 hover:text-emerald-800">
            <ReloadOutlined aria-hidden="true" /> Thử lại
          </button>
        </div>
      )}

      {!isPending && !isError && companies.length === 0 && (
        <p className="mt-4 rounded-xl bg-slate-50 px-3 py-4 text-sm text-slate-500">
          Chưa có nhà tuyển dụng nổi bật.
        </p>
      )}

      {companies.length > 0 && (
        <div className="mt-4 grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-2">
          {companies.map((company) => {
            const displayName = companyDisplayName(company)
            return (
              <Link
                key={company.public_id}
                to={companyJobsPath(company)}
                aria-label={`Xem việc làm tại ${displayName}`}
                title={displayName}
                className="group flex aspect-square min-w-0 items-center justify-center rounded-2xl border border-slate-200 bg-white p-2 shadow-sm transition hover:border-emerald-300 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-primary)] focus-visible:ring-offset-2"
              >
                <CompanyLogo
                  company={company}
                  width={64}
                  height={64}
                  className="h-full w-full rounded-xl border-0 text-lg shadow-none"
                  imageClassName="p-1.5 transition-transform group-hover:scale-105"
                />
              </Link>
            )
          })}
        </div>
      )}
    </aside>
  )
}
