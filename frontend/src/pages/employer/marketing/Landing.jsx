import { ArrowRightOutlined, CheckCircleFilled, RobotOutlined } from '@ant-design/icons'
import { Button } from 'antd'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { employerAppPath } from '@/shared/config/portals'
import ContactBand from './ui/ContactBand'
import StatsBand from './ui/StatsBand'
import {
  AiFeatureSection,
  ConsultationSection,
  CoreFunctions,
  PartnersBand,
  PlatformIntro,
  ServiceHighlights,
  ValuesSection,
} from './ui/LandingSections'

function HeroSection() {
  const { t } = useTranslation('employer')
  const jobs = t('landing.hero.jobs', { returnObjects: true })

  return (
    <section className="relative overflow-hidden bg-[#f3fbf7]">
      <div className="absolute inset-x-0 top-0 h-80 bg-[radial-gradient(circle_at_75%_20%,rgba(16,185,129,0.22),transparent_45%)]" />
      <div className="relative mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 lg:grid-cols-[0.95fr_1.05fr] lg:items-center lg:px-8 lg:py-20">
        <div>
          <span className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-white px-4 py-2 text-xs font-extrabold uppercase tracking-[0.14em] text-emerald-700 shadow-sm">
            <RobotOutlined /> {t('landing.hero.eyebrow')}
          </span>
          <h1 className="mt-6 max-w-3xl text-3xl font-black leading-[1.12] tracking-tight text-slate-950 sm:text-5xl lg:text-6xl">
            {t('landing.hero.title')}
          </h1>
          <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-600">{t('landing.hero.subtitle')}</p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row [&_a]:w-full sm:[&_a]:w-auto [&_.ant-btn]:w-full sm:[&_.ant-btn]:w-auto">
            <Link to={employerAppPath('/register')}><Button type="primary" size="large" shape="round" className="!h-12 !px-7">{t('landing.hero.primaryCta')} <ArrowRightOutlined /></Button></Link>
            <a href="#tu-van"><Button size="large" shape="round" className="!h-12 !px-7">{t('landing.hero.secondaryCta')}</Button></a>
          </div>
          <div className="mt-7 flex flex-col gap-3 text-sm font-semibold text-slate-600 sm:flex-row sm:flex-wrap sm:gap-x-5">
            {t('landing.hero.benefits', { returnObjects: true }).map((benefit) => <span key={benefit} className="flex items-center gap-2"><CheckCircleFilled className="text-emerald-500" />{benefit}</span>)}
          </div>
        </div>

        <div className="relative mx-auto w-full max-w-2xl">
          <div className="absolute -inset-5 rounded-[2.5rem] bg-gradient-to-br from-emerald-300/35 to-cyan-200/10 blur-2xl" />
          <div className="relative rounded-[1.75rem] border border-white/70 bg-white/90 p-4 shadow-[0_30px_90px_rgba(15,118,74,0.18)] backdrop-blur sm:p-6">
            <div className="rounded-2xl bg-slate-950 p-5 text-white sm:p-6">
              <div className="flex flex-col gap-3 border-b border-white/10 pb-5 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0"><p className="text-xs font-bold uppercase tracking-widest text-emerald-300">{t('landing.hero.dashboard')}</p><h2 className="mt-1 text-lg font-bold sm:text-xl">{t('landing.hero.dashboardSubtitle')}</h2></div>
                <span className="w-fit rounded-full bg-emerald-400/15 px-3 py-1 text-xs font-bold text-emerald-300"><span className="mr-1 inline-block h-2 w-2 rounded-full bg-emerald-400" />{t('landing.hero.live')}</span>
              </div>
              <div className="mt-5 grid gap-3">
                {jobs.map((title, index) => {
                  const scores = [92, 84, 78]
                  return (
                    <div key={title} className="grid grid-cols-[1fr_auto] items-center gap-4 rounded-xl border border-white/10 bg-white/[0.06] p-4">
                      <div><p className="font-semibold">{title}</p><p className="mt-1 text-xs text-white/50">{18 - (index * 4)} {t('landing.hero.newProfiles')}</p></div>
                      <div className="text-right"><p className="text-xs text-white/45">{t('landing.hero.match')}</p><p className="text-lg font-black text-emerald-300">{scores[index]}%</p></div>
                    </div>
                  )
                })}
              </div>
            </div>
            <div className="absolute -bottom-5 left-2 rounded-2xl border border-emerald-100 bg-white px-5 py-4 shadow-xl sm:-left-4"><p className="text-xs font-bold text-slate-400">AI SHORTLIST</p><p className="mt-1 text-xl font-black text-emerald-600">24 CV</p></div>
          </div>
        </div>
      </div>
    </section>
  )
}

export default function EmployerLanding() {
  const { t } = useTranslation('employer')
  return (
    <>
      <HeroSection />
      <PlatformIntro />
      <AiFeatureSection />
      <CoreFunctions />
      <ServiceHighlights />
      <StatsBand title={t('landing.statsTitle')} />
      <div id="tu-van"><ConsultationSection /></div>
      <ValuesSection />
      <PartnersBand />
      <ContactBand />
    </>
  )
}
