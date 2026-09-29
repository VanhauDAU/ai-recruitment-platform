import {
  ArrowRightOutlined,
  EnvironmentOutlined,
  SolutionOutlined,
} from '@ant-design/icons'
import { Link } from 'react-router'
import { companyJobsPath } from '@/entities/company'
import CompanyLogo from './CompanyLogo'
import { companyDisplayName } from './company-presentation'

function activeJobCount(company) {
  const value = Number(company?.active_public_job_count)
  return Number.isFinite(value) ? Math.max(0, Math.trunc(value)) : 0
}

export default function SearchCompanyCard({ company }) {
  const displayName = companyDisplayName(company)
  const headquarters = typeof company.headquarters === 'string'
    ? company.headquarters.trim()
    : ''

  return (
    <article className="company-directory-search-card min-w-0">
      <Link
        to={companyJobsPath(company)}
        aria-label={`Xem việc làm tại ${displayName}`}
        className="group flex min-w-0 gap-2.5 rounded-lg border border-slate-200 bg-white p-2.5 !text-inherit shadow-sm transition duration-200 hover:border-emerald-200 hover:shadow-[0_8px_20px_rgba(15,118,110,0.1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-primary)] focus-visible:ring-offset-2 sm:p-3"
      >
        <CompanyLogo
          company={company}
          width={64}
          height={64}
          className="h-14 w-14 rounded-lg text-base sm:h-16 sm:w-16"
          imageClassName="p-1.5"
        />

        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 className="line-clamp-2 text-sm font-bold leading-5 text-slate-900 transition-colors group-hover:text-[var(--brand-primary-hover)] sm:text-base">
                {displayName}
              </h3>
              <p className="mt-0.5 inline-flex items-center gap-1 text-xs font-semibold text-emerald-700">
                <SolutionOutlined aria-hidden="true" />
                Đang tuyển {activeJobCount(company).toLocaleString('vi-VN')} vị trí
              </p>
            </div>
            <ArrowRightOutlined className="mt-0.5 hidden shrink-0 text-sm text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-emerald-600 sm:block" aria-hidden="true" />
          </div>

          {headquarters && (
            <p className="mt-1 flex min-w-0 items-start gap-1 text-xs leading-4 text-slate-500">
              <EnvironmentOutlined className="mt-0.5 shrink-0 text-emerald-600" aria-hidden="true" />
              <span className="line-clamp-1 min-w-0">{headquarters}</span>
            </p>
          )}

          <p className={`mt-1 line-clamp-2 text-xs leading-5 ${company.description_excerpt ? 'text-slate-500' : 'italic text-slate-400'}`}>
            {company.description_excerpt || 'Doanh nghiệp đang cập nhật thêm thông tin giới thiệu.'}
          </p>
        </div>
      </Link>
    </article>
  )
}
