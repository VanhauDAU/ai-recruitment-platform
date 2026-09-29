import {
  ArrowRightOutlined,
  BankOutlined,
  TeamOutlined,
} from '@ant-design/icons'
import { Link } from 'react-router'
import { companyJobsPath } from '@/entities/company'
import CompanyLogo from './CompanyLogo'
import { companyDisplayName, companyInitial } from './company-presentation'

function CompanyCover({ company, eager }) {
  return (
    <div className="company-directory-cover relative aspect-[32/15] overflow-hidden bg-gradient-to-br from-emerald-100 via-emerald-50 to-teal-100">
      <div className="company-directory-cover-fallback absolute inset-0" aria-hidden="true">
        <span className="absolute -right-6 -top-8 h-28 w-28 rounded-full border-[18px] border-white/50" />
        <span className="absolute bottom-3 right-5 text-4xl text-emerald-600/20"><BankOutlined /></span>
        <span className="absolute left-5 top-5 flex h-11 w-11 items-center justify-center rounded-xl border border-white/70 bg-white/65 text-lg font-black text-emerald-700 shadow-sm backdrop-blur-sm">
          {companyInitial(company)}
        </span>
      </div>
      {company.cover_image_url && (
        <img
          src={company.cover_image_url}
          alt=""
          width="1024"
          height="480"
          loading={eager ? 'eager' : 'lazy'}
          fetchPriority={eager ? 'high' : 'auto'}
          decoding="async"
          className="absolute inset-0 h-full w-full object-cover"
          onError={(event) => { event.currentTarget.style.display = 'none' }}
        />
      )}
    </div>
  )
}

export default function CompanyCard({ company, eager = false }) {
  const industries = company.industries_detail || []
  const displayName = companyDisplayName(company)
  const hasDifferentLegalName = company.trade_name
    && company.company_name
    && company.trade_name.trim().toLocaleLowerCase('vi') !== company.company_name.trim().toLocaleLowerCase('vi')

  return (
    <article className="company-directory-card h-full min-w-0">
      <Link
        to={companyJobsPath(company)}
        aria-label={`Xem việc làm tại ${displayName}`}
        className="group flex h-full min-h-[390px] min-w-0 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white !text-inherit shadow-sm transition duration-200 hover:-translate-y-1 hover:border-emerald-200 hover:shadow-[0_16px_36px_rgba(15,118,110,0.12)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-primary)] focus-visible:ring-offset-2"
      >
        <CompanyCover company={company} eager={eager} />

        <div className="relative flex flex-1 flex-col px-5 pb-5 pt-11">
          <div className="absolute -top-8 left-5">
            <CompanyLogo
              company={company}
              eager={eager}
              className="h-16 w-16 rounded-xl text-xl sm:h-[72px] sm:w-[72px]"
              imageClassName="p-1.5"
            />
          </div>

          <h3 className="line-clamp-2 min-h-12 text-base font-extrabold leading-6 text-slate-900 transition-colors group-hover:text-[var(--brand-primary-hover)] sm:text-lg">
            {displayName}
          </h3>
          {hasDifferentLegalName && (
            <p className="mt-1 line-clamp-1 text-xs text-slate-400" title={company.company_name}>
              {company.company_name}
            </p>
          )}

          <div className="mt-3 flex min-h-7 flex-wrap gap-1.5">
            {industries.slice(0, 2).map((industry) => (
              <span key={industry.id || industry.slug} className="rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">
                {industry.name}
              </span>
            ))}
            {industries.length > 2 && (
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-500">
                +{industries.length - 2}
              </span>
            )}
          </div>

          {company.description_excerpt ? (
            <p className="mt-3 line-clamp-3 text-sm leading-6 text-slate-500">
              {company.description_excerpt}
            </p>
          ) : (
            <p className="mt-3 line-clamp-3 text-sm italic leading-6 text-slate-400">
              Doanh nghiệp đang cập nhật thêm thông tin giới thiệu.
            </p>
          )}

          <div className="mt-auto flex items-center justify-between gap-3 border-t border-slate-100 pt-4">
            <span className="inline-flex min-w-0 items-center gap-1.5 text-xs text-slate-500">
              <TeamOutlined className="shrink-0 text-emerald-600" />
              <span className="truncate">{company.company_size_display || 'Quy mô đang cập nhật'}</span>
            </span>
            <span className="inline-flex shrink-0 items-center gap-1 text-sm font-bold text-[var(--brand-primary)]">
              Việc làm <ArrowRightOutlined className="text-xs transition-transform group-hover:translate-x-0.5" />
            </span>
          </div>
        </div>
      </Link>
    </article>
  )
}
