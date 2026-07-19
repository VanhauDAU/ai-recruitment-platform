import { useState } from 'react'
import {
  AppstoreOutlined,
  CheckOutlined,
  PlusCircleOutlined,
  RobotOutlined,
  StarOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import { Button, Result, Skeleton } from 'antd'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { ConsultationModal } from '@/features/request-consultation'
import { formatServicePrice, getPublicServicePackages, pickLocalized } from '@/entities/service-package'
import { employerAppPath } from '@/shared/config/portals'

const CATEGORY_ICONS = {
  featured: <ThunderboltOutlined />,
  combo: <AppstoreOutlined />,
  ai: <RobotOutlined />,
  branding: <StarOutlined />,
  addons: <PlusCircleOutlined />,
}

function CategoryIcon({ category }) {
  const key = category.key?.split('-')[0]
  return CATEGORY_ICONS[key] || <AppstoreOutlined />
}

function PricingSkeleton() {
  return (
    <div aria-label="loading" className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
      <Skeleton active paragraph={{ rows: 1 }} className="max-w-xl" />
      <div className="mt-8 grid gap-5 md:grid-cols-2 xl:grid-cols-3">{[1, 2, 3].map((item) => <div key={item} className="rounded-2xl border border-slate-200 p-6"><Skeleton active paragraph={{ rows: 6 }} /></div>)}</div>
    </div>
  )
}

function PackageCard({ item, language, onConsult }) {
  const { t } = useTranslation('employer')
  const name = pickLocalized(item, 'name', language)
  const tagline = pickLocalized(item, 'tagline', language)
  const unit = pickLocalized(item, 'unit', language)
  const vatNote = pickLocalized(item, 'vat_note', language)
  const badge = pickLocalized(item, 'badge', language)
  const benefits = pickLocalized(item, 'benefits', language) || []
  const price = formatServicePrice(item.price, item.currency, language)
  const actionLabel = item.cta_type === 'register' ? t('pricing.registerCta') : t('pricing.contactCta')

  return (
    <article data-package-slug={item.slug} className={`group relative flex h-full flex-col rounded-2xl border bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-xl ${item.is_highlight ? 'border-2 border-emerald-500 shadow-emerald-950/10' : 'border-slate-200'}`}>
      {(badge || item.is_highlight) && <span className="absolute -top-3 left-6 rounded-full bg-emerald-500 px-3 py-1 text-xs font-extrabold text-white">{badge || t('pricing.popular')}</span>}
      <h3 className="text-2xl font-black text-slate-950">{name}</h3>
      <p className="mt-3 min-h-12 leading-6 text-slate-600">{tagline}</p>
      <div className="mt-6 border-y border-slate-100 py-5">
        <p className="text-3xl font-black tracking-tight text-slate-950">{price || t('pricing.contactPrice')}</p>
        {unit && <p className="mt-1 text-sm font-medium text-slate-500">{unit}</p>}
        {vatNote && <p className="mt-2 text-xs text-slate-400">{vatNote}</p>}
      </div>
      <p className="mt-6 text-sm font-extrabold uppercase tracking-wide text-slate-400">{t('pricing.includes')}</p>
      <ul className="mt-4 flex-1 space-y-3">
        {benefits.map((benefit) => <li key={benefit} className="flex items-start gap-3 text-sm leading-6 text-slate-600"><CheckOutlined className="mt-1 shrink-0 text-emerald-500" />{benefit}</li>)}
      </ul>
      <span className={`mt-7 flex h-10 items-center justify-center rounded-full border px-4 text-sm font-semibold transition ${item.is_highlight ? 'border-[var(--brand-primary)] bg-[var(--brand-primary)] text-white' : 'border-slate-300 text-slate-700 group-hover:border-[var(--brand-primary)] group-hover:text-[var(--brand-primary)]'}`}>
        {actionLabel}
      </span>
      {item.cta_type === 'register' ? (
        <Link to={employerAppPath('/register')} aria-label={`${actionLabel}: ${name}`} className="absolute inset-0 z-10 cursor-pointer rounded-2xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand-primary)]" />
      ) : (
        <button type="button" aria-label={`${actionLabel}: ${name}`} onClick={() => onConsult(name)} className="absolute inset-0 z-10 cursor-pointer rounded-2xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand-primary)]" />
      )}
    </article>
  )
}

export default function EmployerPricing() {
  const { t, i18n } = useTranslation('employer')
  const [selectedPackage, setSelectedPackage] = useState('')
  const query = useQuery({ queryKey: ['service-packages'], queryFn: getPublicServicePackages, staleTime: 5 * 60 * 1000 })
  const language = i18n.language === 'en' ? 'en' : 'vi'
  const categories = Array.isArray(query.data) ? query.data.filter((category) => category.packages?.length) : []

  return (
    <>
      <section className="bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950 text-white">
        <div className="mx-auto max-w-7xl px-4 py-16 text-center sm:px-6 lg:px-8 lg:py-24">
          <span className="rounded-full border border-emerald-300/30 bg-emerald-300/10 px-4 py-2 text-xs font-extrabold uppercase tracking-[0.16em] text-emerald-300">{t('pricing.eyebrow')}</span>
          <h1 className="mx-auto mt-6 max-w-4xl text-3xl font-black leading-tight sm:text-5xl">{t('pricing.title')}</h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg leading-8 text-white/65">{t('pricing.subtitle')}</p>
        </div>
      </section>

      {query.isLoading && <PricingSkeleton />}
      {query.isError && <Result status="warning" title={t('pricing.errorTitle')} subTitle={t('pricing.errorDesc')} extra={<Button type="primary" onClick={() => query.refetch()}>{t('common.startNow')}</Button>} />}
      {!query.isLoading && !query.isError && categories.length === 0 && <Result title={t('pricing.emptyTitle')} subTitle={t('pricing.emptyDesc')} extra={<Button type="primary" onClick={() => setSelectedPackage(t('pricing.emptyTitle'))}>{t('common.consult')}</Button>} />}

      {categories.map((category, categoryIndex) => (
        <section key={category.key} className={categoryIndex % 2 ? 'bg-slate-50' : 'bg-white'}>
          <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8 lg:py-20">
            <div className="flex min-w-0 items-start gap-4">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-xl text-emerald-600"><CategoryIcon category={category} /></span>
              <div className="min-w-0"><h2 className="break-words text-2xl font-extrabold text-slate-950 sm:text-3xl">{pickLocalized(category, 'name', language)}</h2><p className="mt-2 max-w-3xl leading-7 text-slate-600">{pickLocalized(category, 'description', language)}</p></div>
            </div>
            <div className="mt-9 grid items-stretch gap-5 md:grid-cols-2 xl:grid-cols-3">
              {category.packages.map((item) => <PackageCard key={item.slug} item={item} language={language} onConsult={setSelectedPackage} />)}
            </div>
          </div>
        </section>
      ))}

      <section className="bg-emerald-600 px-4 py-14 text-white">
        <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-6 text-center md:flex-row md:text-left">
          <div><h2 className="text-2xl font-bold">{t('pricing.adviceTitle')}</h2><p className="mt-2 max-w-2xl text-white/75">{t('pricing.adviceDesc')}</p></div>
          <Button size="large" shape="round" onClick={() => setSelectedPackage(t('pricing.adviceTitle'))}>{t('common.consult')}</Button>
        </div>
      </section>

      <ConsultationModal
        key={selectedPackage}
        open={Boolean(selectedPackage)}
        onClose={() => setSelectedPackage('')}
        initialValues={{ need: 'buy_service', note: selectedPackage ? `${t('pricing.contactCta')}: ${selectedPackage}` : '' }}
      />
    </>
  )
}
