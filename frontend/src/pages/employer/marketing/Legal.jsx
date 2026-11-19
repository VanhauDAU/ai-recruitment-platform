import { FileProtectOutlined, SafetyCertificateOutlined } from '@ant-design/icons'
import { useLocation } from 'react-router'
import { useSiteSettings } from '@/entities/system/site-settings'
import { m } from '@/shared/config/i18n'

const termsSections = [
  [m.marketing_legal_terms_1_title, m.marketing_legal_terms_1_body],
  [m.marketing_legal_terms_2_title, m.marketing_legal_terms_2_body],
  [m.marketing_legal_terms_3_title, m.marketing_legal_terms_3_body],
  [m.marketing_legal_terms_4_title, m.marketing_legal_terms_4_body],
  [m.marketing_legal_terms_5_title, m.marketing_legal_terms_5_body],
  [m.marketing_legal_terms_6_title, m.marketing_legal_terms_6_body],
]

const privacySections = [
  [m.marketing_legal_privacy_1_title, m.marketing_legal_privacy_1_body],
  [m.marketing_legal_privacy_2_title, m.marketing_legal_privacy_2_body],
  [m.marketing_legal_privacy_3_title, m.marketing_legal_privacy_3_body],
  [m.marketing_legal_privacy_4_title, m.marketing_legal_privacy_4_body],
  [m.marketing_legal_privacy_5_title, m.marketing_legal_privacy_5_body],
  [m.marketing_legal_privacy_6_title, m.marketing_legal_privacy_6_body],
]

export default function EmployerLegal() {
  const { pathname } = useLocation()
  const { siteName } = useSiteSettings()
  const isPrivacy = pathname.includes('chinh-sach-quyen-rieng')
  const title = isPrivacy ? m.marketing_meta_privacy() : m.marketing_meta_terms()
  const sections = isPrivacy ? privacySections : termsSections
  const Icon = isPrivacy ? FileProtectOutlined : SafetyCertificateOutlined

  return (
    <main className="bg-slate-50 py-12 sm:py-16">
      <div className="mx-auto max-w-4xl px-4 sm:px-6">
        <header className="rounded-3xl bg-[linear-gradient(135deg,#073e35,#06845f)] p-7 text-white shadow-xl shadow-emerald-950/10 sm:p-10">
          <Icon className="text-3xl text-emerald-200" />
          <h1 className="mt-4 text-3xl font-black sm:text-4xl">{title}</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-white/70">{m.marketing_legal_applies_to({ siteName })}</p>
          <p className="mt-5 text-xs font-semibold uppercase tracking-widest text-emerald-200">{m.marketing_legal_version()}</p>
        </header>
        <article className="mt-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-10">
          <p className="text-sm leading-7 text-slate-600">{m.marketing_legal_intro()}</p>
          <div className="mt-8 space-y-8">
            {sections.map(([heading, body]) => (
              <section key={heading()}>
                <h2 className="text-lg font-black text-slate-900">{heading()}</h2>
                <p className="mt-2 text-sm leading-7 text-slate-600">{body()}</p>
              </section>
            ))}
          </div>
        </article>
      </div>
    </main>
  )
}
