import { GlobalOutlined, SolutionOutlined, TeamOutlined } from '@ant-design/icons'
import CompanyLogo from './CompanyLogo'

function HeroStat({ icon, children }) {
  return (
    <li className="inline-flex items-center gap-1.5 text-sm text-gray-500">
      <span className="company-profile-hero__icon" aria-hidden="true">{icon}</span>
      {children}
    </li>
  )
}

/** `actions` là chỗ gắn nút của nền tảng (xem việc làm, theo dõi, báo cáo). */
export default function CompanyHero({ profile, actions, titleAs: Title = 'h1' }) {
  const { identity, stats } = profile
  const industries = identity.industries || []
  const jobCount = Number(stats?.active_public_job_count) || 0
  const hasWebsite = /^https?:\/\//i.test(identity.website_url || '')

  return (
    <section aria-labelledby="company-profile-name" className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
      <div className={`company-profile-cover ${identity.cover_image_url ? '' : 'company-profile-cover--fallback'}`}>
        {identity.cover_image_url && (
          <img
            src={identity.cover_image_url}
            alt=""
            width="1152"
            height="288"
            decoding="async"
            fetchPriority="high"
            onError={(event) => { event.currentTarget.style.display = 'none' }}
          />
        )}
      </div>

      <div className="company-profile-hero">
        <CompanyLogo
          company={{ trade_name: identity.display_name, logo_url: identity.logo_url }}
          eager
          width={96}
          height={96}
          className="company-profile-logo"
          imageClassName="p-1.5"
        />

        <div className="company-profile-hero__main">
          <Title id="company-profile-name" className="break-words text-xl font-bold leading-snug text-slate-900 sm:text-2xl">
            {identity.display_name}
          </Title>
          {identity.legal_name && (
            <p className="mt-1 break-words text-sm font-medium text-gray-600">{identity.legal_name}</p>
          )}
          {industries.length > 0 && (
            <ul className="company-profile-chips" aria-label="Lĩnh vực hoạt động">
              {industries.map((industry) => (
                <li key={industry.id ?? industry.slug} className="company-profile-chip">{industry.name}</li>
              ))}
            </ul>
          )}
          <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1">
            {stats?.company_size_display && (
              <HeroStat icon={<TeamOutlined />}>{stats.company_size_display}</HeroStat>
            )}
            <HeroStat icon={<SolutionOutlined />}>
              {jobCount > 0
                ? `${jobCount.toLocaleString('vi-VN')} việc làm đang tuyển`
                : 'Chưa có việc làm đang tuyển'}
            </HeroStat>
          </ul>
        </div>

        {(actions || hasWebsite) && (
          <div className="company-profile-hero__actions">
            {actions}
            {hasWebsite && (
              <a
                href={identity.website_url}
                target="_blank"
                rel="noopener noreferrer nofollow"
                className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-emerald-300 px-4 text-sm font-semibold !text-[var(--brand-primary)] transition hover:!bg-emerald-50"
              >
                <GlobalOutlined aria-hidden="true" /> Website
              </a>
            )}
          </div>
        )}
      </div>
    </section>
  )
}
