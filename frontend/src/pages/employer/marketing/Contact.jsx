import {
  ClockCircleOutlined,
  EnvironmentOutlined,
  MailOutlined,
  MessageOutlined,
  PhoneOutlined,
} from '@ant-design/icons'
import { Button } from 'antd'
import { settingText, useSiteSettings } from '@/entities/system/site-settings'
import { m } from '@/shared/config/i18n'

function InfoRow({ icon, label, value, href }) {
  const Container = href ? 'a' : 'div'
  return (
    <Container
      href={href}
      className="flex items-start gap-3 rounded-2xl border border-gray-100 !bg-white p-5 shadow-sm transition hover:border-[var(--brand-primary)]/40"
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--brand-primary)]/10 text-[var(--brand-primary)]">
        {icon}
      </span>
      <span className="min-w-0">
        <span className="block text-sm text-gray-500">{label}</span>
        <span className="block break-words font-semibold text-gray-900">{value}</span>
      </span>
    </Container>
  )
}

export default function EmployerContact() {
  const { settings } = useSiteSettings()

  const hotline = settingText(settings.hotline)
  const hotlineNorth = settingText(settings.employer_hotline_north, hotline)
  const hotlineSouth = settingText(settings.employer_hotline_south)
  const email = settingText(settings.support_email)
  const address = settingText(settings.contact_address)
  const workingHours = settingText(settings.contact_working_hours)
  const zaloUrl = settingText(settings.contact_zalo_url)
  const messengerUrl = settingText(settings.contact_messenger_url)
  const mapEmbedUrl = settingText(settings.contact_map_embed_url)
  const telHref = (phone) => `tel:${phone.replace(/[^+\d]/g, '')}`

  return (
    <>
      <section className="bg-gradient-to-br from-[var(--brand-primary-soft)] via-white to-[var(--brand-primary-soft)]">
        <div className="mx-auto max-w-7xl px-4 py-14 text-center sm:px-6 lg:px-8">
          <span className="rounded-full bg-[var(--brand-primary)]/10 px-4 py-1.5 text-sm font-bold text-[var(--brand-primary-hover)]">
            {m.marketing_contact_hero_eyebrow()}
          </span>
          <h1 className="mx-auto mt-5 max-w-3xl text-3xl font-extrabold text-gray-950 sm:text-4xl md:text-5xl">
            {m.marketing_contact_hero_title()}
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg leading-8 text-gray-600">{m.marketing_contact_hero_subtitle()}</p>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-4 py-14 sm:px-6 lg:px-8">
        <h2 className="text-center text-2xl font-bold text-gray-950">{m.marketing_contact_info_title()}</h2>
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {hotlineNorth && (
            <InfoRow icon={<PhoneOutlined />} label={m.marketing_footer_hotline_north()} value={hotlineNorth} href={telHref(hotlineNorth)} />
          )}
          {hotlineSouth && (
            <InfoRow icon={<PhoneOutlined />} label={m.marketing_footer_hotline_south()} value={hotlineSouth} href={telHref(hotlineSouth)} />
          )}
          {email && <InfoRow icon={<MailOutlined />} label={m.marketing_contact_band_support_email()} value={email} href={`mailto:${email}`} />}
          {workingHours && <InfoRow icon={<ClockCircleOutlined />} label={m.marketing_contact_band_working_hours()} value={workingHours} />}
          {address && <InfoRow icon={<EnvironmentOutlined />} label={m.marketing_contact_address()} value={address} />}
        </div>

        {(zaloUrl || messengerUrl) && (
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            {zaloUrl && (
              <a href={zaloUrl} target="_blank" rel="noreferrer">
                <Button shape="round" icon={<MessageOutlined />}>{m.marketing_contact_chat_zalo()}</Button>
              </a>
            )}
            {messengerUrl && (
              <a href={messengerUrl} target="_blank" rel="noreferrer">
                <Button shape="round" icon={<MessageOutlined />}>{m.marketing_contact_chat_messenger()}</Button>
              </a>
            )}
          </div>
        )}

        {mapEmbedUrl && (
          <iframe
            src={mapEmbedUrl}
            title={m.marketing_contact_map_title()}
            loading="lazy"
            className="mt-8 h-72 w-full rounded-2xl border border-gray-200 sm:h-96"
            referrerPolicy="no-referrer-when-downgrade"
          />
        )}
      </section>
    </>
  )
}
