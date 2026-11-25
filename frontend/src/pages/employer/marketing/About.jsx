import { BarChartOutlined, HeartOutlined, RobotOutlined } from '@ant-design/icons'
import { Button } from 'antd'
import { Link } from 'react-router'
import { useSiteSettings } from '@/entities/system/site-settings'
import { employerAppPath, employerMarketingPath } from '@/shared/config/portals'
import ContactBand from './ui/ContactBand'
import StatsBand from './ui/StatsBand'
import { m } from '@/shared/config/i18n'

const VALUE_ITEMS = [
  { key: 'ai', icon: <RobotOutlined />, title: m.marketing_about_values_ai_title, desc: m.marketing_about_values_ai_desc },
  { key: 'efficiency', icon: <BarChartOutlined />, title: m.marketing_about_values_efficiency_title, desc: m.marketing_about_values_efficiency_desc },
  { key: 'companion', icon: <HeartOutlined />, title: m.marketing_about_values_companion_title, desc: m.marketing_about_values_companion_desc },
]

export default function EmployerAbout() {
  const { siteName } = useSiteSettings()

  return (
    <>
      <section className="bg-gradient-to-br from-[var(--brand-primary-soft)] via-white to-[var(--brand-primary-soft)]">
        <div className="mx-auto max-w-7xl px-4 py-16 text-center sm:px-6 lg:px-8 lg:py-24">
          <span className="rounded-full bg-[var(--brand-primary)]/10 px-4 py-1.5 text-sm font-bold text-[var(--brand-primary-hover)]">
            {m.marketing_about_hero_eyebrow()}
          </span>
          <h1 className="mx-auto mt-5 max-w-3xl text-3xl font-extrabold leading-tight text-gray-950 sm:text-4xl md:text-5xl">
            {m.marketing_about_hero_title()}
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg leading-8 text-gray-600">{m.marketing_about_hero_subtitle()}</p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row [&_a]:w-full sm:[&_a]:w-auto [&_.ant-btn]:w-full sm:[&_.ant-btn]:w-auto">
            <Link to={employerAppPath('/register')}>
              <Button type="primary" size="large" shape="round" className="!h-12 !px-7">{m.marketing_common_register()}</Button>
            </Link>
            <Link to={employerMarketingPath('/lien-he')}>
              <Button size="large" shape="round" className="!h-12 !px-7">{m.marketing_common_consult()}</Button>
            </Link>
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-10 px-4 py-16 sm:px-6 lg:grid-cols-2 lg:items-center lg:px-8">
        <div>
          <h2 className="text-3xl font-bold text-gray-950">{m.marketing_about_who_title()}</h2>
          <p className="mt-5 leading-8 text-gray-600">{m.marketing_about_who_body1()}</p>
          <p className="mt-4 leading-8 text-gray-600">{m.marketing_about_who_body2()}</p>
        </div>
        <div className="min-w-0 rounded-2xl border border-[var(--brand-primary)]/15 bg-gradient-to-br from-[#f0fff6] to-white p-5 shadow-[0_24px_80px_color-mix(in_srgb,var(--brand-primary)_10%,transparent)] sm:p-8">
          <p className="break-words text-3xl font-extrabold text-[var(--brand-primary)] sm:text-5xl">{siteName}</p>
          <p className="mt-4 text-lg font-semibold text-gray-800">{m.marketing_footer_tagline()}</p>
        </div>
      </section>

      <section className="bg-gray-50">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
          <h2 className="text-center text-3xl font-bold text-gray-950">{m.marketing_about_values_title()}</h2>
          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {VALUE_ITEMS.map((item) => (
              <div key={item.key} className="rounded-xl bg-white p-7 shadow-sm">
                <span className="text-3xl text-[var(--brand-primary)]">{item.icon}</span>
                <h3 className="mt-4 text-xl font-bold text-gray-900">{item.title()}</h3>
                <p className="mt-3 leading-7 text-gray-600">{item.desc()}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <StatsBand title={m.marketing_about_stats_title()} />
      <ContactBand />
    </>
  )
}
