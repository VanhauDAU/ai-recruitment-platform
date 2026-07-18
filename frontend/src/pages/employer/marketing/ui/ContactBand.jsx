import { MailOutlined, PhoneOutlined } from '@ant-design/icons'
import { useTranslation } from 'react-i18next'
import { settingText, useSiteSettings } from '@/entities/site-settings'

function ContactCard({ icon, label, value, href }) {
  return (
    <a
      href={href}
      className="flex items-center gap-4 rounded-xl border border-white/15 bg-white/10 p-5 transition hover:bg-white/20"
    >
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white text-lg text-[var(--brand-primary)]">
        {icon}
      </span>
      <span>
        <span className="block text-sm text-white/70">{label}</span>
        <span className="block text-lg font-bold text-white">{value}</span>
      </span>
    </a>
  )
}

// Band liên hệ cuối trang: hotline 2 miền + email, dữ liệu từ site settings.
export default function ContactBand() {
  const { t } = useTranslation('employer')
  const { settings } = useSiteSettings()

  const hotline = settingText(settings.hotline)
  const hotlineNorth = settingText(settings.employer_hotline_north, hotline)
  const hotlineSouth = settingText(settings.employer_hotline_south)
  const email = settingText(settings.support_email)
  if (!hotlineNorth && !hotlineSouth && !email) return null

  const telHref = (phone) => `tel:${phone.replace(/[^+\d]/g, '')}`

  return (
    <section className="bg-[var(--brand-primary-hover)]">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-2xl font-bold text-white md:text-3xl">{t('contactBand.title')}</h2>
          <p className="mt-3 leading-7 text-white/80">{t('contactBand.subtitle')}</p>
        </div>
        <div className="mx-auto mt-8 grid max-w-4xl gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {hotlineNorth && (
            <ContactCard icon={<PhoneOutlined />} label={t('footer.hotlineNorth')} value={hotlineNorth} href={telHref(hotlineNorth)} />
          )}
          {hotlineSouth && (
            <ContactCard icon={<PhoneOutlined />} label={t('footer.hotlineSouth')} value={hotlineSouth} href={telHref(hotlineSouth)} />
          )}
          {email && (
            <ContactCard icon={<MailOutlined />} label={t('contactBand.supportEmail')} value={email} href={`mailto:${email}`} />
          )}
        </div>
      </div>
    </section>
  )
}
