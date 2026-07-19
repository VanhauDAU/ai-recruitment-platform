import { BarChartOutlined, HeartOutlined, RobotOutlined } from '@ant-design/icons'
import { Button } from 'antd'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { useSiteSettings } from '@/entities/site-settings'
import { employerAppPath, employerMarketingPath } from '@/shared/config/portals'
import ContactBand from './ui/ContactBand'
import StatsBand from './ui/StatsBand'

const VALUE_ITEMS = [
  { key: 'ai', icon: <RobotOutlined /> },
  { key: 'efficiency', icon: <BarChartOutlined /> },
  { key: 'companion', icon: <HeartOutlined /> },
]

export default function EmployerAbout() {
  const { t } = useTranslation('employer')
  const { siteName } = useSiteSettings()

  return (
    <>
      <section className="bg-gradient-to-br from-[#eafff3] via-white to-[#f7fff9]">
        <div className="mx-auto max-w-7xl px-4 py-16 text-center sm:px-6 lg:px-8 lg:py-24">
          <span className="rounded-full bg-[var(--brand-primary)]/10 px-4 py-1.5 text-sm font-bold text-[var(--brand-primary-hover)]">
            {t('about.heroEyebrow')}
          </span>
          <h1 className="mx-auto mt-5 max-w-3xl text-3xl font-extrabold leading-tight text-gray-950 sm:text-4xl md:text-5xl">
            {t('about.heroTitle')}
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg leading-8 text-gray-600">{t('about.heroSubtitle')}</p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row [&_a]:w-full sm:[&_a]:w-auto [&_.ant-btn]:w-full sm:[&_.ant-btn]:w-auto">
            <Link to={employerAppPath('/register')}>
              <Button type="primary" size="large" shape="round" className="!h-12 !px-7">{t('common.register')}</Button>
            </Link>
            <Link to={employerMarketingPath('/lien-he')}>
              <Button size="large" shape="round" className="!h-12 !px-7">{t('common.consult')}</Button>
            </Link>
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-10 px-4 py-16 sm:px-6 lg:grid-cols-2 lg:items-center lg:px-8">
        <div>
          <h2 className="text-3xl font-bold text-gray-950">{t('about.whoTitle')}</h2>
          <p className="mt-5 leading-8 text-gray-600">{t('about.whoBody1')}</p>
          <p className="mt-4 leading-8 text-gray-600">{t('about.whoBody2')}</p>
        </div>
        <div className="min-w-0 rounded-2xl border border-[var(--brand-primary)]/15 bg-gradient-to-br from-[#f0fff6] to-white p-5 shadow-[0_24px_80px_rgba(0,177,79,0.10)] sm:p-8">
          <p className="break-words text-3xl font-extrabold text-[var(--brand-primary)] sm:text-5xl">{siteName}</p>
          <p className="mt-4 text-lg font-semibold text-gray-800">{t('footer.tagline')}</p>
        </div>
      </section>

      <section className="bg-gray-50">
        <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
          <h2 className="text-center text-3xl font-bold text-gray-950">{t('about.valuesTitle')}</h2>
          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {VALUE_ITEMS.map((item) => (
              <div key={item.key} className="rounded-xl bg-white p-7 shadow-sm">
                <span className="text-3xl text-[var(--brand-primary)]">{item.icon}</span>
                <h3 className="mt-4 text-xl font-bold text-gray-900">{t(`about.values.${item.key}.title`)}</h3>
                <p className="mt-3 leading-7 text-gray-600">{t(`about.values.${item.key}.desc`)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <StatsBand title={t('about.statsTitle')} />
      <ContactBand />
    </>
  )
}
