import {
  CheckCircleFilled,
  FundProjectionScreenOutlined,
  NotificationOutlined,
  RobotOutlined,
  SafetyCertificateOutlined,
} from '@ant-design/icons'
import { Button } from 'antd'
import { Link } from 'react-router'
import { employerAppPath, employerMarketingPath } from '@/shared/config/portals'
import { m } from '@/shared/config/i18n'

const SECTIONS = [
  {
    key: 'posting',
    Icon: NotificationOutlined,
    title: m.marketing_services_page_sections_posting_title,
    desc: m.marketing_services_page_sections_posting_desc,
    benefits: [m.marketing_services_page_sections_posting_benefits_1, m.marketing_services_page_sections_posting_benefits_2, m.marketing_services_page_sections_posting_benefits_3],
  },
  {
    key: 'pipeline',
    Icon: FundProjectionScreenOutlined,
    title: m.marketing_services_page_sections_pipeline_title,
    desc: m.marketing_services_page_sections_pipeline_desc,
    benefits: [m.marketing_services_page_sections_pipeline_benefits_1, m.marketing_services_page_sections_pipeline_benefits_2, m.marketing_services_page_sections_pipeline_benefits_3],
  },
  {
    key: 'ai',
    Icon: RobotOutlined,
    title: m.marketing_services_page_sections_ai_title,
    desc: m.marketing_services_page_sections_ai_desc,
    benefits: [m.marketing_services_page_sections_ai_benefits_1, m.marketing_services_page_sections_ai_benefits_2, m.marketing_services_page_sections_ai_benefits_3],
  },
  {
    key: 'branding',
    Icon: SafetyCertificateOutlined,
    title: m.marketing_services_page_sections_branding_title,
    desc: m.marketing_services_page_sections_branding_desc,
    benefits: [m.marketing_services_page_sections_branding_benefits_1, m.marketing_services_page_sections_branding_benefits_2, m.marketing_services_page_sections_branding_benefits_3],
  },
]

function ServiceVisual({ Icon, index }) {
  return (
    <div className="relative mx-auto flex min-h-72 w-full max-w-lg items-center justify-center overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 to-slate-800 p-5 text-white shadow-xl shadow-slate-950/10 sm:p-8">
      <div className="absolute -right-16 -top-16 h-52 w-52 rounded-full bg-[var(--brand-primary)]/20 blur-2xl" />
      <div className="relative w-full">
        <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--brand-primary)] text-3xl text-slate-950"><Icon /></span>
        <div className="mt-8 space-y-3">
          {[88, 70, 52].map((width, row) => (
            <div key={width} className="rounded-xl border border-white/10 bg-white/5 p-4">
              <div className="flex items-center gap-3"><span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/10 text-xs font-bold">{index + 1}.{row + 1}</span><div className="h-2 rounded-full bg-white/20" style={{ width: `${width}%` }} /></div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default function EmployerServices() {
  return (
    <>
      <section className="bg-gradient-to-br from-[var(--brand-primary-soft)] via-white to-cyan-50">
        <div className="mx-auto max-w-7xl px-4 py-16 text-center sm:px-6 lg:px-8 lg:py-24">
          <span className="rounded-full border border-[var(--brand-primary)]/20 bg-white px-4 py-2 text-xs font-extrabold uppercase tracking-[0.16em] text-[var(--brand-primary-hover)]">{m.marketing_services_page_eyebrow()}</span>
          <h1 className="mx-auto mt-6 max-w-4xl text-3xl font-black leading-tight text-slate-950 sm:text-5xl">{m.marketing_services_page_title()}</h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg leading-8 text-slate-600">{m.marketing_services_page_subtitle()}</p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row [&_a]:w-full sm:[&_a]:w-auto [&_.ant-btn]:w-full sm:[&_.ant-btn]:w-auto">
            <Link to={employerAppPath('/dang-ky')}><Button type="primary" size="large" shape="round" className="!h-12 !px-7">{m.marketing_common_start_now()}</Button></Link>
            <Link to={employerMarketingPath('/lien-he')}><Button size="large" shape="round" className="!h-12 !px-7">{m.marketing_nav_contact()}</Button></Link>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8 lg:py-16">
        {SECTIONS.map(({ key, Icon, title, desc, benefits }, index) => (
          <section key={key} className={`grid gap-10 border-b border-slate-100 py-14 last:border-0 lg:grid-cols-2 lg:items-center lg:py-20 ${index % 2 ? 'lg:[&>*:first-child]:order-2' : ''}`}>
            <ServiceVisual Icon={Icon} index={index} />
            <div className="max-w-xl">
              <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-[var(--brand-primary)]">0{index + 1}</p>
              <h2 className="mt-4 text-3xl font-extrabold text-slate-950">{title()}</h2>
              <p className="mt-4 text-lg leading-8 text-slate-600">{desc()}</p>
              <ul className="mt-6 space-y-3">
                {benefits.map((benefit, i) => <li key={i} className="flex items-start gap-3 leading-7 text-slate-600"><CheckCircleFilled className="mt-1.5 text-[var(--brand-primary)]" />{benefit()}</li>)}
              </ul>
            </div>
          </section>
        ))}
      </div>

      <section className="bg-slate-950 px-4 py-14 text-white">
        <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-6 text-center md:flex-row md:text-left">
          <div><h2 className="text-2xl font-bold">{m.marketing_services_page_cta_title()}</h2><p className="mt-2 text-white/60">{m.marketing_services_page_cta_desc()}</p></div>
          <div className="flex w-full shrink-0 flex-col gap-3 sm:w-auto sm:flex-row [&_a]:w-full sm:[&_a]:w-auto [&_.ant-btn]:w-full sm:[&_.ant-btn]:w-auto"><Link to={employerAppPath('/dang-ky')}><Button type="primary" size="large" shape="round">{m.marketing_common_register()}</Button></Link><Link to={employerMarketingPath('/lien-he')}><Button ghost size="large" shape="round">{m.marketing_nav_contact()}</Button></Link></div>
        </div>
      </section>
    </>
  )
}
