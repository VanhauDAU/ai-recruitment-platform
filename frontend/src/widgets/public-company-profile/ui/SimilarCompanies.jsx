import { Link } from 'react-router'
import { companyDetailPath, companyDisplayName, CompanyLogo } from '@/entities/company'

export default function SimilarCompanies({ companies }) {
  return (
    <ul className="space-y-3">
      {companies.map((company) => {
        const jobCount = Number(company.active_public_job_count) || 0
        return (
          <li key={company.public_id}>
            <Link to={companyDetailPath(company)} className="group flex min-w-0 items-center gap-3 !text-inherit">
              <CompanyLogo
                company={company}
                width={48}
                height={48}
                className="h-12 w-12 rounded-lg text-base"
                imageClassName="p-1"
              />
              <span className="min-w-0">
                <span className="line-clamp-2 text-sm font-semibold leading-5 text-slate-800 transition-colors group-hover:text-[var(--brand-primary-hover)]">
                  {companyDisplayName(company)}
                </span>
                <span className="mt-0.5 block text-xs text-gray-500">
                  {jobCount > 0
                    ? `${jobCount.toLocaleString('vi-VN')} việc làm đang tuyển`
                    : 'Chưa có việc làm đang tuyển'}
                </span>
              </span>
            </Link>
          </li>
        )
      })}
    </ul>
  )
}
