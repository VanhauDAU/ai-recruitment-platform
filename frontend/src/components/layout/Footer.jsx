import {
  AndroidFilled,
  AppleFilled,
  ClockCircleOutlined,
  EnvironmentOutlined,
  FacebookFilled,
  LinkedinFilled,
  MailOutlined,
  PhoneOutlined,
  TikTokOutlined,
  YoutubeFilled,
} from '@ant-design/icons'
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { getLinkGroups } from '../../api/siteService'
import { DEFAULT_SITE_SETTINGS } from '../../contexts/siteSettingsContext'
import { settingText, useSiteSettings } from '../../hooks/useSiteSettings'

function SmartLink({ href, className = '', children, ...props }) {
  if (!href) {
    return <span className={`${className} cursor-default text-gray-400`} title="Tính năng đang được cập nhật">{children}</span>
  }
  if (href.startsWith('/')) {
    return <Link to={href} className={className} {...props}>{children}</Link>
  }
  return (
    <a href={href} className={className} target="_blank" rel="noreferrer" {...props}>
      {children}
    </a>
  )
}

function MenuGroup({ group }) {
  if (!group.items?.length) return null
  return (
    <section aria-labelledby={`footer-${group.key}`}>
      <h2 id={`footer-${group.key}`} className="mb-4 text-sm font-bold text-slate-900">
        {group.title}
      </h2>
      <ul className="space-y-2.5 text-sm text-slate-600">
        {group.items.map((item, index) => (
          <li key={`${item.label}-${index}`}>
            <SmartLink href={item.url} className="!text-slate-600 transition-colors hover:!text-[var(--brand-primary)]">
              {item.label}
            </SmartLink>
          </li>
        ))}
      </ul>
    </section>
  )
}

function ContactRow({ icon, href, children }) {
  const content = (
    <span className="group flex items-start gap-2.5 text-sm leading-5 text-slate-600 transition-colors hover:text-[var(--brand-primary)]">
      <span className="mt-0.5 shrink-0 text-[var(--brand-primary)]">{icon}</span>
      <span>{children}</span>
    </span>
  )
  return href ? <a href={href}>{content}</a> : content
}

function StoreButton({ href, icon, eyebrow, label }) {
  if (!href) return null
  return (
    <SmartLink
      href={href}
      className="inline-flex min-w-36 items-center gap-2 rounded-lg bg-slate-900 px-3 py-2 text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-slate-700"
    >
      <span className="text-2xl leading-none">{icon}</span>
      <span className="leading-none">
        <span className="block text-[9px] uppercase tracking-wide text-slate-300">{eyebrow}</span>
        <span className="mt-1 block text-sm font-semibold">{label}</span>
      </span>
    </SmartLink>
  )
}

export default function Footer() {
  const { settings, siteName } = useSiteSettings()
  const [groups, setGroups] = useState([])

  useEffect(() => {
    let active = true
    if (settings.footer_show_link_groups === false) {
      setGroups([])
      return () => { active = false }
    }
    getLinkGroups('footer_nav')
      .then((data) => { if (active) setGroups(Array.isArray(data) ? data : []) })
      .catch(() => { if (active) setGroups([]) })
    return () => { active = false }
  }, [settings.footer_show_link_groups])

  const logoUrl = settingText(
    settings.footer_logo_url,
    settingText(settings.brand_logo_url, DEFAULT_SITE_SETTINGS.brand_logo_url),
  )
  const description = settingText(settings.footer_description, DEFAULT_SITE_SETTINGS.footer_description)
  const copyright = settingText(settings.footer_copyright, DEFAULT_SITE_SETTINGS.footer_copyright)
    .replaceAll('{year}', String(new Date().getFullYear()))
    .replaceAll('{site_name}', siteName)
  const phone = settingText(settings.hotline)
  const email = settingText(settings.support_email)
  const address = settingText(settings.contact_address)
  const workingHours = settingText(settings.contact_working_hours)
  const companyName = settingText(settings.footer_company_name)
  const businessLicense = settingText(settings.footer_business_license)
  const qrUrl = settingText(settings.footer_qr_code_url)
  const showContact = settings.footer_show_contact !== false && Boolean(phone || email || address || workingHours)
  const showApps = settings.footer_show_apps !== false && Boolean(
    settingText(settings.footer_app_store_url) || settingText(settings.footer_google_play_url),
  )

  const socials = useMemo(() => [
    { label: 'Facebook', href: settingText(settings.footer_facebook_url), icon: <FacebookFilled /> },
    { label: 'LinkedIn', href: settingText(settings.footer_linkedin_url), icon: <LinkedinFilled /> },
    { label: 'YouTube', href: settingText(settings.footer_youtube_url), icon: <YoutubeFilled /> },
    { label: 'TikTok', href: settingText(settings.footer_tiktok_url), icon: <TikTokOutlined /> },
  ].filter((item) => item.href), [settings])
  const showSocials = settings.footer_show_socials !== false && socials.length > 0

  return (
    <footer className="mt-auto border-t border-slate-200 bg-white text-slate-700">
      <div className="h-1 bg-gradient-to-r from-[var(--brand-primary)] via-emerald-400 to-teal-500" />

      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
        <div className="grid gap-10 lg:grid-cols-[minmax(220px,1.15fr)_2fr] xl:gap-16">
          <div>
            <Link to="/" className="inline-flex" aria-label={`Trang chủ ${siteName}`}>
              {logoUrl ? (
                <img src={logoUrl} alt={siteName} className="h-11 max-w-[210px] object-contain object-left" />
              ) : (
                <span className="text-2xl font-extrabold text-slate-900">{siteName}</span>
              )}
            </Link>
            {description && <p className="mt-4 max-w-sm text-sm leading-6 text-slate-600">{description}</p>}

            {showContact && (
              <div className="mt-6 space-y-3">
                <h2 className="text-sm font-bold text-slate-900">Liên hệ</h2>
                {phone && <ContactRow icon={<PhoneOutlined />} href={`tel:${phone.replace(/[^+\d]/g, '')}`}>{phone}</ContactRow>}
                {email && <ContactRow icon={<MailOutlined />} href={`mailto:${email}`}>{email}</ContactRow>}
                {address && <ContactRow icon={<EnvironmentOutlined />}>{address}</ContactRow>}
                {workingHours && <ContactRow icon={<ClockCircleOutlined />}>{workingHours}</ContactRow>}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-x-6 gap-y-10 sm:grid-cols-3">
            {groups.map((group) => <MenuGroup key={group.key} group={group} />)}
          </div>
        </div>

        {(qrUrl || showApps || showSocials) && (
          <div className="mt-10 grid gap-8 border-t border-slate-200 pt-8 sm:grid-cols-2 lg:grid-cols-[1fr_auto]">
            <div className="flex flex-col gap-7 sm:flex-row sm:items-end sm:gap-10">
              {showApps && (
                <div>
                  <h2 className="mb-3 text-sm font-bold text-slate-900">Ứng dụng tải xuống</h2>
                  <div className="flex flex-wrap gap-2">
                    <StoreButton href={settingText(settings.footer_app_store_url)} icon={<AppleFilled />} eyebrow="Download on the" label="App Store" />
                    <StoreButton href={settingText(settings.footer_google_play_url)} icon={<AndroidFilled />} eyebrow="Get it on" label="Google Play" />
                  </div>
                </div>
              )}

              {showSocials && (
                <div>
                  <h2 className="mb-3 text-sm font-bold text-slate-900">Kết nối với {siteName}</h2>
                  <div className="flex gap-2">
                    {socials.map((social) => (
                      <SmartLink
                        key={social.label}
                        href={social.href}
                        aria-label={social.label}
                        title={social.label}
                        className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-lg text-slate-600 transition hover:-translate-y-0.5 hover:bg-[var(--brand-primary)] hover:text-white"
                      >
                        {social.icon}
                      </SmartLink>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {qrUrl && (
              <div className="flex items-center gap-3 sm:justify-end">
                <img src={qrUrl} alt={settingText(settings.footer_qr_label, `QR ${siteName}`)} className="h-24 w-24 rounded-lg border border-slate-200 bg-white object-contain p-1" />
                {settings.footer_qr_label && <p className="max-w-28 text-xs leading-5 text-slate-500">{settings.footer_qr_label}</p>}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="border-t border-slate-200 bg-slate-50">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-5 text-xs leading-5 text-slate-500 sm:px-6 lg:px-8">
          {(companyName || businessLicense) && (
            <div>
              {companyName && <p className="font-semibold text-slate-700">{companyName}</p>}
              {businessLicense && <p className="mt-1 whitespace-pre-line">{businessLicense}</p>}
            </div>
          )}
          <p>{copyright}</p>
        </div>
      </div>
    </footer>
  )
}
