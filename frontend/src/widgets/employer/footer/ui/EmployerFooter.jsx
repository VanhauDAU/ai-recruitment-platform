import {
  EnvironmentOutlined,
  FacebookFilled,
  LinkedinFilled,
  MailOutlined,
  PhoneOutlined,
  TikTokOutlined,
  YoutubeFilled,
} from '@ant-design/icons'
import { useMemo } from 'react'
import { Link } from 'react-router'
import { CookieSettingsButton } from '@/features/common/privacy/cookie-consent'
import { BrandLogo, DEFAULT_SITE_SETTINGS, settingText, useSiteSettings } from '@/entities/system/site-settings'
import { employerAppPath, employerMarketingPath, MAIN_PORTAL_URL, mainSitePath } from '@/shared/config/portals'
import { m } from '@/shared/config/i18n'

function FooterLink({ href, children }) {
  const className = 'text-sm text-slate-600 transition-colors hover:text-[var(--brand-primary)]'
  if (href.startsWith('/') && !href.startsWith('//')) {
    return <Link to={href} className={className}>{children}</Link>
  }
  return <a href={href} className={className}>{children}</a>
}

function ContactRow({ icon, href, children }) {
  const content = (
    <span className="flex items-start gap-2.5 text-sm leading-6 text-slate-600 transition-colors hover:text-[var(--brand-primary)]">
      <span className="mt-1 shrink-0 text-[var(--brand-primary)]">{icon}</span>
      <span>{children}</span>
    </span>
  )
  return href ? <a href={href}>{content}</a> : content
}

const telHref = (phone) => `tel:${phone.replace(/[^+\d]/g, '')}`

export default function EmployerFooter() {
  const { settings, siteName } = useSiteSettings()

  const hotline = settingText(settings.hotline)
  const hotlineNorth = settingText(settings.employer_hotline_north, hotline)
  const hotlineSouth = settingText(settings.employer_hotline_south)
  const email = settingText(settings.support_email)
  const address = settingText(settings.contact_address)
  const companyName = settingText(settings.footer_company_name)
  const businessLicense = settingText(settings.footer_business_license)
  const copyright = settingText(settings.footer_copyright, DEFAULT_SITE_SETTINGS.footer_copyright)
    .replaceAll('{year}', String(new Date().getFullYear()))
    .replaceAll('{site_name}', siteName)

  const marketingLinks = [
    { label: m.marketing_nav_about(), href: employerMarketingPath('/gioi-thieu') },
    { label: m.marketing_nav_services(), href: employerMarketingPath('/dich-vu') },
    { label: m.marketing_nav_contact(), href: employerMarketingPath('/lien-he') },
    { label: m.marketing_nav_post_job(), href: employerAppPath('/dang-ky') },
  ]
  const candidateLinks = [
    { label: m.marketing_footer_candidate_portal(), href: MAIN_PORTAL_URL },
    { label: m.marketing_footer_create_cv(), href: mainSitePath('/mau-cv') },
  ]

  const socials = useMemo(() => [
    { label: 'Facebook', href: settingText(settings.footer_facebook_url), icon: <FacebookFilled /> },
    { label: 'LinkedIn', href: settingText(settings.footer_linkedin_url), icon: <LinkedinFilled /> },
    { label: 'YouTube', href: settingText(settings.footer_youtube_url), icon: <YoutubeFilled /> },
    { label: 'TikTok', href: settingText(settings.footer_tiktok_url), icon: <TikTokOutlined /> },
  ].filter((item) => item.href && settings.footer_show_socials !== false), [settings])

  return (
    <footer className="border-t border-slate-200 bg-white">
      <div className="h-1 bg-gradient-to-r from-[var(--brand-primary)] via-[var(--brand-primary)] to-[var(--brand-primary-hover)]" />

      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-10 sm:px-6 md:grid-cols-2 lg:grid-cols-[1.3fr_1fr_1fr_1.2fr] lg:px-8 lg:py-14">
        <div>
          <BrandLogo to={employerMarketingPath('')} variant="full" className="inline-flex" imageClassName="h-10 max-w-[190px]" />
          <p className="mt-4 max-w-sm text-sm leading-6 text-slate-600">{m.marketing_footer_tagline()}</p>
          {socials.length > 0 && (
            <div className="mt-5">
              <h2 className="mb-3 text-sm font-bold text-slate-900">{m.marketing_footer_connect_with()}</h2>
              <div className="flex gap-2">
                {socials.map((social) => (
                  <a
                    key={social.label}
                    href={social.href}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={social.label}
                    className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-lg text-slate-600 transition hover:-translate-y-0.5 hover:bg-[var(--brand-primary)] hover:text-white"
                  >
                    {social.icon}
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>

        <nav aria-label={m.marketing_footer_for_employers()}>
          <h2 className="mb-4 text-sm font-bold text-slate-900">{m.marketing_footer_for_employers()}</h2>
          <ul className="space-y-2.5">
            {marketingLinks.map((link) => (
              <li key={link.href}><FooterLink href={link.href}>{link.label}</FooterLink></li>
            ))}
          </ul>
        </nav>

        <nav aria-label={m.marketing_footer_for_candidates()}>
          <h2 className="mb-4 text-sm font-bold text-slate-900">{m.marketing_footer_for_candidates()}</h2>
          <ul className="space-y-2.5">
            {candidateLinks.map((link) => (
              <li key={link.href}><FooterLink href={link.href}>{link.label}</FooterLink></li>
            ))}
          </ul>
        </nav>

        {settings.footer_show_contact !== false && <div>
          <h2 className="mb-4 text-sm font-bold text-slate-900">{m.marketing_footer_contact_title()}</h2>
          <div className="space-y-3">
            {hotlineNorth && (
              <ContactRow icon={<PhoneOutlined />} href={telHref(hotlineNorth)}>
                {m.marketing_footer_hotline_north()}: <span className="font-semibold">{hotlineNorth}</span>
              </ContactRow>
            )}
            {hotlineSouth && (
              <ContactRow icon={<PhoneOutlined />} href={telHref(hotlineSouth)}>
                {m.marketing_footer_hotline_south()}: <span className="font-semibold">{hotlineSouth}</span>
              </ContactRow>
            )}
            {email && <ContactRow icon={<MailOutlined />} href={`mailto:${email}`}>{email}</ContactRow>}
            {address && <ContactRow icon={<EnvironmentOutlined />}>{address}</ContactRow>}
          </div>
        </div>}
      </div>

      <div className="border-t border-slate-200 bg-slate-50">
        <div className="mx-auto max-w-7xl px-4 py-5 text-xs leading-5 text-slate-500 sm:px-6 lg:px-8">
          {companyName && <p className="font-semibold text-slate-700">{companyName}</p>}
          {businessLicense && <p className="mt-1 whitespace-pre-line">{businessLicense}</p>}
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2">
            <p>{copyright}</p>
            <a href={mainSitePath('/chinh-sach-cookie')} className="font-semibold text-slate-600 hover:text-[var(--brand-primary)]">{m.account_cookie_policy()}</a>
            <CookieSettingsButton />
          </div>
        </div>
      </div>
    </footer>
  )
}
