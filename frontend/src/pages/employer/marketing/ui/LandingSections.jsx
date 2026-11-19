import {
  BarChartOutlined,
  CheckCircleFilled,
  DatabaseOutlined,
  FundProjectionScreenOutlined,
  NotificationOutlined,
  RobotOutlined,
  SafetyCertificateOutlined,
  TeamOutlined,
} from '@ant-design/icons'
import { useSiteSetting } from '@/entities/system/site-settings'
import { getLocale, m } from '@/shared/config/i18n'

const FUNCTION_ITEMS = [
  ['posting', NotificationOutlined, m.marketing_landing_functions_items_posting_title, m.marketing_landing_functions_items_posting_desc],
  ['pipeline', FundProjectionScreenOutlined, m.marketing_landing_functions_items_pipeline_title, m.marketing_landing_functions_items_pipeline_desc],
  ['matching', RobotOutlined, m.marketing_landing_functions_items_matching_title, m.marketing_landing_functions_items_matching_desc],
  ['database', DatabaseOutlined, m.marketing_landing_functions_items_database_title, m.marketing_landing_functions_items_database_desc],
  ['analytics', BarChartOutlined, m.marketing_landing_functions_items_analytics_title, m.marketing_landing_functions_items_analytics_desc],
  ['branding', SafetyCertificateOutlined, m.marketing_landing_functions_items_branding_title, m.marketing_landing_functions_items_branding_desc],
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
        <Eyebrow>{m.marketing_landing_platform_eyebrow()}</Eyebrow>
        <h2 className="mt-4 text-3xl font-extrabold leading-tight text-slate-950 sm:text-4xl">{m.marketing_landing_platform_title()}</h2>
        <p className="mt-5 text-lg leading-8 text-slate-600">{m.marketing_landing_platform_desc()}</p>
        <div className="mt-7"><CheckList items={[m.marketing_landing_platform_points_1(), m.marketing_landing_platform_points_2(), m.marketing_landing_platform_points_3()]} /></div>
      </div>
    </section>
  )
}

export function AiFeatureSection() {
  return (
    <section className="bg-slate-950 text-white">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-16 sm:px-6 lg:grid-cols-2 lg:items-center lg:px-8 lg:py-24">
        <div>
          <Eyebrow light>{m.marketing_landing_ai_eyebrow()}</Eyebrow>
          <h2 className="mt-4 text-3xl font-extrabold leading-tight sm:text-4xl">{m.marketing_landing_ai_title()}</h2>
          <p className="mt-5 text-lg leading-8 text-white/65">{m.marketing_landing_ai_desc()}</p>
          <div className="mt-7"><CheckList light items={[m.marketing_landing_ai_features_1(), m.marketing_landing_ai_features_2(), m.marketing_landing_ai_features_3(), m.marketing_landing_ai_features_4()]} /></div>
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
  return (
    <section className="bg-slate-50">
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
        <div className="mx-auto max-w-3xl text-center">
          <Eyebrow>{m.marketing_landing_functions_eyebrow()}</Eyebrow>
          <h2 className="mt-4 text-3xl font-extrabold text-slate-950 sm:text-4xl">{m.marketing_landing_functions_title()}</h2>
          <p className="mt-4 text-lg leading-8 text-slate-600">{m.marketing_landing_functions_subtitle()}</p>
        </div>
        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {FUNCTION_ITEMS.map(([key, Icon, title, desc]) => (
            <article key={key} className="group rounded-2xl border border-slate-200 bg-white p-6 transition hover:-translate-y-1 hover:border-emerald-200 hover:shadow-xl hover:shadow-emerald-950/5">
              <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-50 text-xl text-emerald-600 transition group-hover:bg-emerald-500 group-hover:text-white"><Icon /></span>
              <h3 className="mt-5 text-xl font-bold text-slate-900">{title()}</h3>
              <p className="mt-3 leading-7 text-slate-600">{desc()}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}

export function ValuesSection() {
  const groups = [
    ['business', BarChartOutlined, m.marketing_landing_values_business_title(), [m.marketing_landing_values_business_1(), m.marketing_landing_values_business_2(), m.marketing_landing_values_business_3()]],
    ['recruiter', TeamOutlined, m.marketing_landing_values_recruiter_title(), [m.marketing_landing_values_recruiter_1(), m.marketing_landing_values_recruiter_2(), m.marketing_landing_values_recruiter_3()]],
  ]
  return (
    <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8 lg:py-24">
      <div className="mx-auto max-w-3xl text-center"><Eyebrow>{m.marketing_landing_values_eyebrow()}</Eyebrow><h2 className="mt-4 text-3xl font-extrabold text-slate-950 sm:text-4xl">{m.marketing_landing_values_title()}</h2></div>
      <div className="mt-10 grid gap-5 lg:grid-cols-2">
        {groups.map(([key, Icon, title, items], index) => (
          <article key={key} className={`rounded-3xl p-7 sm:p-9 ${index ? 'bg-emerald-600 text-white' : 'bg-slate-950 text-white'}`}>
            <span className="text-3xl text-emerald-300"><Icon /></span><h3 className="mt-5 text-2xl font-bold">{title}</h3><div className="mt-6"><CheckList light items={items} /></div>
          </article>
        ))}
      </div>
    </section>
  )
}

export function PartnersBand() {
  const partners = useSiteSetting('employer_partners', [])
  if (!Array.isArray(partners) || partners.length === 0) return null
  return (
    <section className="border-y border-slate-100 bg-slate-50">
      <div className="mx-auto max-w-7xl px-4 py-12 text-center sm:px-6 lg:px-8">
        <h2 className="text-2xl font-bold text-slate-900">{m.marketing_landing_partners_title()}</h2>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-4 sm:gap-6">
          {partners.map((partner) => partner.logo_url ? (
            <div key={partner.name || partner.logo_url} className="flex h-20 w-40 items-center justify-center rounded-xl border border-slate-200 bg-white p-4"><img src={partner.logo_url} alt={partner[`name_${getLocale()}`] || partner.name || ''} className="max-h-full max-w-full object-contain" loading="lazy" /></div>
          ) : null)}
        </div>
      </div>
    </section>
  )
}
