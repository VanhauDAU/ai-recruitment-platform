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
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { BrandLogo, DEFAULT_SITE_SETTINGS, settingText, useSiteSettings } from '@/entities/site-settings'
import { employerAppPath, employerMarketingPath, MAIN_PORTAL_URL } from '@/shared/config/portals'

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
  const { t } = useTranslation('employer')
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
    { label: t('nav.about'), href: employerMarketingPath('/gioi-thieu') },
    { label: t('nav.services'), href: employerMarketingPath('/dich-vu') },
    { label: t('nav.pricing'), href: employerMarketingPath('/bao-gia') },
    { label: t('nav.contact'), href: employerMarketingPath('/lien-he') },
    { label: t('nav.postJob'), href: employerAppPath('/register') },
  ]
  const candidateLinks = [
    { label: t('footer.candidatePortal'), href: MAIN_PORTAL_URL },
    { label: t('footer.createCv'), href: MAIN_PORTAL_URL === '/' ? '/mau-cv' : `${MAIN_PORTAL_URL}mau-cv` },
  ]

  const socials = useMemo(() => [
    { label: 'Facebook', href: settingText(settings.footer_facebook_url), icon: <FacebookFilled /> },
    { label: 'LinkedIn', href: settingText(settings.footer_linkedin_url), icon: <LinkedinFilled /> },
    { label: 'YouTube', href: settingText(settings.footer_youtube_url), icon: <YoutubeFilled /> },
    { label: 'TikTok', href: settingText(settings.footer_tiktok_url), icon: <TikTokOutlined /> },
  ].filter((item) => item.href), [settings])

  return (
    <footer className="border-t border-slate-200 bg-white">
      <div className="h-1 bg-gradient-to-r from-[var(--brand-primary)] via-emerald-400 to-teal-500" />

      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-10 sm:px-6 md:grid-cols-2 lg:grid-cols-[1.3fr_1fr_1fr_1.2fr] lg:px-8 lg:py-14">
        <div>
          <BrandLogo to={employerMarketingPath('')} variant="full" className="inline-flex" imageClassName="h-10 max-w-[190px]" />
          <p className="mt-4 max-w-sm text-sm leading-6 text-slate-600">{t('footer.tagline')}</p>
          {socials.length > 0 && (
            <div className="mt-5">
              <h2 className="mb-3 text-sm font-bold text-slate-900">{t('footer.connectWith')}</h2>
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

        <nav aria-label={t('footer.forEmployers')}>
          <h2 className="mb-4 text-sm font-bold text-slate-900">{t('footer.forEmployers')}</h2>
          <ul className="space-y-2.5">
            {marketingLinks.map((link) => (
              <li key={link.href}><FooterLink href={link.href}>{link.label}</FooterLink></li>
            ))}
          </ul>
        </nav>

        <nav aria-label={t('footer.forCandidates')}>
          <h2 className="mb-4 text-sm font-bold text-slate-900">{t('footer.forCandidates')}</h2>
          <ul className="space-y-2.5">
            {candidateLinks.map((link) => (
              <li key={link.href}><FooterLink href={link.href}>{link.label}</FooterLink></li>
            ))}
          </ul>
        </nav>

        <div>
          <h2 className="mb-4 text-sm font-bold text-slate-900">{t('footer.contactTitle')}</h2>
          <div className="space-y-3">
            {hotlineNorth && (
              <ContactRow icon={<PhoneOutlined />} href={telHref(hotlineNorth)}>
                {t('footer.hotlineNorth')}: <span className="font-semibold">{hotlineNorth}</span>
              </ContactRow>
            )}
            {hotlineSouth && (
              <ContactRow icon={<PhoneOutlined />} href={telHref(hotlineSouth)}>
                {t('footer.hotlineSouth')}: <span className="font-semibold">{hotlineSouth}</span>
              </ContactRow>
            )}
            {email && <ContactRow icon={<MailOutlined />} href={`mailto:${email}`}>{email}</ContactRow>}
            {address && <ContactRow icon={<EnvironmentOutlined />}>{address}</ContactRow>}
          </div>
        </div>
      </div>

      <div className="border-t border-slate-200 bg-slate-50">
        <div className="mx-auto max-w-7xl px-4 py-5 text-xs leading-5 text-slate-500 sm:px-6 lg:px-8">
          {companyName && <p className="font-semibold text-slate-700">{companyName}</p>}
          {businessLicense && <p className="mt-1 whitespace-pre-line">{businessLicense}</p>}
          <p className="mt-2">{copyright}</p>
        </div>
      </div>
    </footer>
  )
}
