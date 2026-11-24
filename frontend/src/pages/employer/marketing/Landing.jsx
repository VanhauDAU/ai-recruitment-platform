import { ArrowRightOutlined, CheckCircleFilled, RobotOutlined } from '@ant-design/icons'
import { Button } from 'antd'
import { Link } from 'react-router'
import { employerAppPath, employerMarketingPath } from '@/shared/config/portals'
import ContactBand from './ui/ContactBand'
import StatsBand from './ui/StatsBand'
import {
  AiFeatureSection,
  CoreFunctions,
  PartnersBand,
  PlatformIntro,
  ValuesSection,
} from './ui/LandingSections'
import { m } from '@/shared/config/i18n'

function HeroSection() {
  const jobs = [m.marketing_landing_hero_jobs_1(), m.marketing_landing_hero_jobs_2(), m.marketing_landing_hero_jobs_3()]

  return (
    <section className="relative overflow-hidden bg-[#f3fbf7]">
      <div className="absolute inset-x-0 top-0 h-80 bg-[radial-gradient(circle_at_75%_20%,color-mix(in_srgb,var(--brand-primary)_22%,transparent),transparent_45%)]" />
      <div className="relative mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 lg:grid-cols-[0.95fr_1.05fr] lg:items-center lg:px-8 lg:py-20">
        <div>
          <span className="inline-flex items-center gap-2 rounded-full border border-[var(--brand-primary)]/20 bg-white px-4 py-2 text-xs font-extrabold uppercase tracking-[0.14em] text-[var(--brand-primary-hover)] shadow-sm">
            <RobotOutlined /> {m.marketing_landing_hero_eyebrow()}
          </span>
          <h1 className="mt-6 max-w-3xl text-3xl font-black leading-[1.12] tracking-tight text-slate-950 sm:text-5xl lg:text-6xl">
            {m.marketing_landing_hero_title()}
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-600">{m.marketing_landing_hero_subtitle()}</p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row [&_a]:w-full sm:[&_a]:w-auto [&_.ant-btn]:w-full sm:[&_.ant-btn]:w-auto">
            <Link to={employerAppPath('/register')}><Button type="primary" size="large" shape="round" className="!h-12 !px-7">{m.marketing_landing_hero_primary_cta()} <ArrowRightOutlined /></Button></Link>
            <Link to={employerMarketingPath('/dich-vu')}><Button size="large" shape="round" className="!h-12 !px-7">{m.marketing_landing_hero_secondary_cta()}</Button></Link>
          </div>
          <div className="mt-7 flex flex-col gap-3 text-sm font-semibold text-slate-600 sm:flex-row sm:flex-wrap sm:gap-x-5">
            {[m.marketing_landing_hero_benefits_1(), m.marketing_landing_hero_benefits_2(), m.marketing_landing_hero_benefits_3()].map((benefit) => <span key={benefit} className="flex items-center gap-2"><CheckCircleFilled className="text-[var(--brand-primary)]" />{benefit}</span>)}
          </div>
        </div>

        <div className="relative mx-auto w-full max-w-2xl">
          <div className="absolute -inset-5 rounded-[2.5rem] bg-gradient-to-br from-[var(--brand-primary)]/35 to-cyan-200/10 blur-2xl" />
          <div className="relative rounded-[1.75rem] border border-white/70 bg-white/90 p-4 shadow-[0_30px_90px_rgba(15,118,74,0.18)] backdrop-blur sm:p-6">
            <div className="rounded-2xl bg-slate-950 p-5 text-white sm:p-6">
              <div className="flex flex-col gap-3 border-b border-white/10 pb-5 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0"><p className="text-xs font-bold uppercase tracking-widest text-[color-mix(in_srgb,var(--brand-primary)_40%,#fff)]">{m.marketing_landing_hero_dashboard()}</p><h2 className="mt-1 text-lg font-bold sm:text-xl">{m.marketing_landing_hero_dashboard_subtitle()}</h2></div>
                <span className="w-fit rounded-full bg-[var(--brand-primary)]/15 px-3 py-1 text-xs font-bold text-[color-mix(in_srgb,var(--brand-primary)_40%,#fff)]"><span className="mr-1 inline-block h-2 w-2 rounded-full bg-[var(--brand-primary)]" />{m.marketing_landing_hero_live()}</span>
              </div>
              <div className="mt-5 grid gap-3">
                {jobs.map((title, index) => {
                  const scores = [92, 84, 78]
                  return (
                    <div key={title} className="grid grid-cols-[1fr_auto] items-center gap-4 rounded-xl border border-white/10 bg-white/[0.06] p-4">
                      <div><p className="font-semibold">{title}</p><p className="mt-1 text-xs text-white/50">{18 - (index * 4)} {m.marketing_landing_hero_new_profiles()}</p></div>
                      <div className="text-right"><p className="text-xs text-white/45">{m.marketing_landing_hero_match()}</p><p className="text-lg font-black text-[color-mix(in_srgb,var(--brand-primary)_40%,#fff)]">{scores[index]}%</p></div>
                    </div>
                  )
                })}
              </div>
            </div>
            <div className="absolute -bottom-5 left-2 rounded-2xl border border-[var(--brand-primary)]/20 bg-white px-5 py-4 shadow-xl sm:-left-4"><p className="text-xs font-bold text-slate-400">AI SHORTLIST</p><p className="mt-1 text-xl font-black text-[var(--brand-primary)]">24 CV</p></div>
          </div>
        </div>
      </div>
    </section>
  )
}

export default function EmployerLanding() {
  return (
    <>
      <HeroSection />
      <PlatformIntro />
      <AiFeatureSection />
      <CoreFunctions />
      <StatsBand title={m.marketing_landing_stats_title()} />
      <ValuesSection />
      <PartnersBand />
      <ContactBand />
    </>
  )
}
