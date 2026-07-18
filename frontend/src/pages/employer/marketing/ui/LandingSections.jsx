import {
  BarChartOutlined,
  CheckCircleFilled,
  DatabaseOutlined,
  FileSearchOutlined,
  FundProjectionScreenOutlined,
  NotificationOutlined,
  RobotOutlined,
  SafetyCertificateOutlined,
  StarOutlined,
  TeamOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons'
import { Button } from 'antd'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { ConsultationForm } from '@/features/request-consultation'
import { useSiteSetting } from '@/entities/site-settings'
import { employerMarketingPath } from '@/shared/config/portals'

const FUNCTION_ITEMS = [
  ['posting', NotificationOutlined],
  ['pipeline', FundProjectionScreenOutlined],
  ['matching', RobotOutlined],
  ['database', DatabaseOutlined],
  ['analytics', BarChartOutlined],
  ['branding', SafetyCertificateOutlined],
]

const SERVICE_ITEMS = [
  ['featured', ThunderboltOutlined],
  ['combo', StarOutlined],
  ['ai', RobotOutlined],
  ['branding', SafetyCertificateOutlined],
  ['addons', FileSearchOutlined],
]

function Eyebrow({ children, light = false }) {
  return <p className={`text-xs font-extrabold uppercase tracking-[0.18em] ${light ? 'text-emerald-300' : 'text-[var(--brand-primary)]'}`}>{children}</p>
}

function CheckList({ items, light = false }) {
  return (
    <ul className="space-y-3">
      {items.map((item) => (
        <li key={item} className={`flex items-start gap-3 leading-7 ${light ? 'text-white/80' : 'text-slate-600'}`}>
          <CheckCircleFilled className="mt-1.5 shrink-0 text-[var(--brand-primary)]" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  )
}

export function PlatformIntro() {
  const { t } = useTranslation('employer')
  return (
    <section className="mx-auto grid max-w-7xl gap-10 px-4 py-16 sm:px-6 lg:grid-cols-[0.9fr_1.1fr] lg:items-center lg:px-8 lg:py-24">
      <div className="relative min-h-80 overflow-hidden rounded-3xl bg-slate-950 p-7 text-white shadow-2xl shadow-emerald-950/15 sm:p-10">
        <div className="absolute -right-14 -top-14 h-48 w-48 rounded-full bg-emerald-400/20 blur-2xl" />
        <div className="relative">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-400 text-2xl text-slate-950"><TeamOutlined /></div>
          <p className="mt-8 text-sm font-bold text-white/50">Recruitment workspace</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {['Talent sourcing', 'CV screening', 'Hiring pipeline', 'Performance report'].map((label, index) => (
              <div key={label} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <span className="text-xs text-white/45">0{index + 1}</span>
                <p className="mt-2 font-semibold">{label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div>
        <Eyebrow>{t('landing.platform.eyebrow')}</Eyebrow>
        <h2 className="mt-4 text-3xl font-extrabold leading-tight text-slate-950 sm:text-4xl">{t('landing.platform.title')}</h2>
        <p className="mt-5 text-lg leading-8 text-slate-600">{t('landing.platform.desc')}</p>
        <div className="mt-7"><CheckList items={t('landing.platform.points', { returnObjects: true })} /></div>
      </div>
    </section>
  )
}

export function AiFeatureSection() {
  const { t } = useTranslation('employer')
  return (
    <section className="bg-slate-950 text-white">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-16 sm:px-6 lg:grid-cols-2 lg:items-center lg:px-8 lg:py-24">
        <div>
          <Eyebrow light>{t('landing.ai.eyebrow')}</Eyebrow>
          <h2 className="mt-4 text-3xl font-extrabold leading-tight sm:text-4xl">{t('landing.ai.title')}</h2>
          <p className="mt-5 text-lg leading-8 text-white/65">{t('landing.ai.desc')}</p>
          <div className="mt-7"><CheckList light items={t('landing.ai.features', { returnObjects: true })} /></div>
        </div>
        <div className="relative mx-auto w-full max-w-lg rounded-3xl border border-white/10 bg-white/5 p-5 sm:p-8">
          <div className="absolute -inset-px -z-10 rounded-3xl bg-gradient-to-br from-emerald-400/30 to-transparent blur-xl" />
          <div className="flex items-center justify-between rounded-2xl bg-white p-5 text-slate-900">
            <div><p className="text-xs font-bold uppercase tracking-wide text-slate-400">AI candidate match</p><p className="mt-1 font-bold">Senior Product Designer</p></div>
            <span className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50 text-xl font-black text-emerald-600">92%</span>
          </div>
          {[['Kinh nghiệm phù hợp', '96%'], ['Kỹ năng chuyên môn', '90%'], ['Ngành nghề liên quan', '86%']].map(([label, value]) => (
            <div key={label} className="mt-4 rounded-xl border border-white/10 bg-white/5 p-4">
              <div className="flex justify-between text-sm"><span className="text-white/70">{label}</span><strong>{value}</strong></div>
              <div className="mt-3 h-1.5 rounded-full bg-white/10"><div className="h-full rounded-full bg-emerald-400" style={{ width: value }} /></div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

export function CoreFunctions() {
  const { t } = useTranslation('employer')
  return (
    <section className="bg-slate-50">
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
        <div className="mx-auto max-w-3xl text-center">
          <Eyebrow>{t('landing.functions.eyebrow')}</Eyebrow>
          <h2 className="mt-4 text-3xl font-extrabold text-slate-950 sm:text-4xl">{t('landing.functions.title')}</h2>
          <p className="mt-4 text-lg leading-8 text-slate-600">{t('landing.functions.subtitle')}</p>
        </div>
        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {FUNCTION_ITEMS.map(([key, Icon]) => (
            <article key={key} className="group rounded-2xl border border-slate-200 bg-white p-6 transition hover:-translate-y-1 hover:border-emerald-200 hover:shadow-xl hover:shadow-emerald-950/5">
              <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-50 text-xl text-emerald-600 transition group-hover:bg-emerald-500 group-hover:text-white"><Icon /></span>
              <h3 className="mt-5 text-xl font-bold text-slate-900">{t(`landing.functions.items.${key}.title`)}</h3>
              <p className="mt-3 leading-7 text-slate-600">{t(`landing.functions.items.${key}.desc`)}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}

export function ServiceHighlights() {
  const { t } = useTranslation('employer')
  return (
    <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
      <div className="flex flex-col justify-between gap-5 md:flex-row md:items-end">
        <div className="max-w-3xl"><Eyebrow>{t('landing.services.eyebrow')}</Eyebrow><h2 className="mt-4 text-3xl font-extrabold text-slate-950 sm:text-4xl">{t('landing.services.title')}</h2><p className="mt-4 text-lg leading-8 text-slate-600">{t('landing.services.subtitle')}</p></div>
        <Link to={employerMarketingPath('/dich-vu')}><Button shape="round" size="large">{t('common.seeServices')}</Button></Link>
      </div>
      <div className="mt-10 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {SERVICE_ITEMS.map(([key, Icon], index) => (
          <Link key={key} to={employerMarketingPath(index < 3 ? '/bao-gia' : '/dich-vu')} className="group cursor-pointer rounded-2xl border border-slate-200 p-5 transition hover:border-emerald-300 hover:bg-emerald-50/50">
            <span className="text-2xl text-emerald-600"><Icon /></span>
            <h3 className="mt-6 font-bold leading-6 text-slate-900">{t(`landing.services.items.${key}`)}</h3>
            <span className="mt-5 inline-block text-sm font-bold text-emerald-600 transition group-hover:translate-x-1">{t('common.learnMore')} →</span>
          </Link>
        ))}
      </div>
    </section>
  )
}

export function ConsultationSection() {
  const { t } = useTranslation('employer')
  return (
    <section className="bg-gradient-to-br from-emerald-50 to-white">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-16 sm:px-6 lg:grid-cols-[0.8fr_1.2fr] lg:items-center lg:px-8 lg:py-24">
        <div><Eyebrow>{t('landing.consultation.eyebrow')}</Eyebrow><h2 className="mt-4 text-3xl font-extrabold leading-tight text-slate-950 sm:text-4xl">{t('landing.consultation.title')}</h2><p className="mt-5 text-lg leading-8 text-slate-600">{t('landing.consultation.desc')}</p></div>
        <div className="rounded-3xl border border-emerald-100 bg-white p-6 shadow-xl shadow-emerald-950/5 sm:p-8"><ConsultationForm /></div>
      </div>
    </section>
  )
}

export function ValuesSection() {
  const { t } = useTranslation('employer')
  const groups = [['business', BarChartOutlined], ['recruiter', TeamOutlined]]
  return (
    <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
      <div className="mx-auto max-w-3xl text-center"><Eyebrow>{t('landing.values.eyebrow')}</Eyebrow><h2 className="mt-4 text-3xl font-extrabold text-slate-950 sm:text-4xl">{t('landing.values.title')}</h2></div>
      <div className="mt-10 grid gap-5 lg:grid-cols-2">
        {groups.map(([key, Icon], index) => (
          <article key={key} className={`rounded-3xl p-7 sm:p-9 ${index ? 'bg-emerald-600 text-white' : 'bg-slate-950 text-white'}`}>
            <span className="text-3xl text-emerald-300"><Icon /></span><h3 className="mt-5 text-2xl font-bold">{t(`landing.values.${key}Title`)}</h3><div className="mt-6"><CheckList light items={t(`landing.values.${key}`, { returnObjects: true })} /></div>
          </article>
        ))}
      </div>
    </section>
  )
}

export function PartnersBand() {
  const { t, i18n } = useTranslation('employer')
  const partners = useSiteSetting('employer_partners', [])
  if (!Array.isArray(partners) || partners.length === 0) return null
  return (
    <section className="border-y border-slate-100 bg-slate-50">
      <div className="mx-auto max-w-7xl px-4 py-12 text-center sm:px-6 lg:px-8">
        <h2 className="text-2xl font-bold text-slate-900">{t('landing.partnersTitle')}</h2>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-4 sm:gap-6">
          {partners.map((partner) => partner.logo_url ? (
            <div key={partner.name || partner.logo_url} className="flex h-20 w-40 items-center justify-center rounded-xl border border-slate-200 bg-white p-4"><img src={partner.logo_url} alt={partner[`name_${i18n.language}`] || partner.name || ''} className="max-h-full max-w-full object-contain" loading="lazy" /></div>
          ) : null)}
        </div>
      </div>
    </section>
  )
}
