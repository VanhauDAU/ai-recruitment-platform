import { BarChartOutlined, CheckCircleFilled, RobotOutlined, TeamOutlined } from '@ant-design/icons'
import { ConfigProvider } from 'antd'
import { GoogleReCaptchaProvider } from 'react-google-recaptcha-v3'
import { Outlet, useLocation } from 'react-router'
import { DEFAULT_SITE_SETTINGS, settingText, useSiteSettings } from '@/entities/system/site-settings'
import { LanguageSwitcher } from '@/features/common/preferences/switch-language'
import { m } from '@/shared/config/i18n'

function HiringFunnelVisual() {
  return (
    <aside className="relative hidden min-h-screen overflow-hidden bg-[radial-gradient(circle_at_70%_18%,rgba(34,197,94,0.22),transparent_28%),linear-gradient(155deg,#071a2b_0%,#0b2635_50%,#082d2a_100%)] px-10 py-12 text-white lg:flex lg:sticky lg:top-0 lg:h-screen lg:flex-col lg:justify-between">
      <div className="absolute -right-24 top-24 h-72 w-72 rounded-full border border-emerald-400/15" />
      <div className="absolute -right-10 top-36 h-48 w-48 rounded-full border border-emerald-400/15" />
      <div className="relative">
        <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-bold uppercase tracking-[0.18em] text-[color-mix(in_srgb,var(--brand-primary)_40%,#fff)]">
          <RobotOutlined /> AI Recruitment Workspace
        </span>
        <h2 className="mt-6 max-w-lg text-3xl font-black leading-tight xl:text-4xl">
          {m.employer_workspace_auth_visual_title()}
        </h2>
        <p className="mt-4 max-w-md leading-7 text-white/65">
          {m.employer_workspace_auth_visual_subtitle()}
        </p>
      </div>

      <div className="relative mx-auto w-full max-w-md rounded-3xl border border-white/10 bg-white/[0.07] p-5 shadow-2xl shadow-black/30 backdrop-blur">
        <div className="flex items-center justify-between border-b border-white/10 pb-4">
          <div><p className="text-xs font-bold uppercase tracking-widest text-[color-mix(in_srgb,var(--brand-primary)_40%,#fff)]">Hiring funnel</p><p className="mt-1 font-bold">{m.employer_workspace_auth_visual_campaign()}</p></div>
          <BarChartOutlined className="text-2xl text-[color-mix(in_srgb,var(--brand-primary)_40%,#fff)]" />
        </div>
        <div className="mt-5 grid grid-cols-3 gap-3">
          {[
            [m.employer_workspace_auth_visual_candidates(), '248', <TeamOutlined key="team" />],
            [m.employer_workspace_auth_visual_matched(), '76', <RobotOutlined key="robot" />],
            [m.employer_workspace_auth_visual_interviews(), '24', <CheckCircleFilled key="check" />],
          ].map(([label, value, icon]) => (
            <div key={label} className="rounded-2xl bg-black/15 p-3">
              <span className="text-[color-mix(in_srgb,var(--brand-primary)_40%,#fff)]">{icon}</span>
              <strong className="mt-3 block text-2xl">{value}</strong>
              <span className="text-xs text-white/55">{label}</span>
            </div>
          ))}
        </div>
        <div className="mt-5 space-y-3">
          {[86, 62, 38].map((width, index) => (
            <div key={width} className="h-3 overflow-hidden rounded-full bg-white/10">
              <div className="h-full rounded-full bg-gradient-to-r from-[var(--brand-primary)] to-teal-300" style={{ width: `${width}%`, opacity: 1 - index * 0.18 }} />
            </div>
          ))}
        </div>
      </div>

      <div className="relative flex items-center justify-between text-xs text-white/45">
        <span>Smart Recruitment Platform</span>
        <span className="flex gap-1.5"><i className="h-2 w-2 rounded-full bg-[var(--brand-primary)]" /><i className="h-2 w-2 rounded-full bg-white/30" /><i className="h-2 w-2 rounded-full bg-white/30" /></span>
      </div>
    </aside>
  )
}

export default function EmployerAuthLayout() {
  const { pathname } = useLocation()
  const { settings, siteName } = useSiteSettings()
  const brandColor = settingText(settings.brand_primary_color, DEFAULT_SITE_SETTINGS.brand_primary_color)
  const isWide = pathname.endsWith('/register') || pathname.endsWith('/complete-profile')

  return (
    <ConfigProvider theme={{ token: { borderRadius: 10, colorPrimary: brandColor } }}>
      <GoogleReCaptchaProvider reCaptchaKey={import.meta.env.VITE_RECAPTCHA_SITE_KEY}>
        <div className="min-h-dvh overflow-x-hidden bg-white text-slate-900 lg:grid lg:grid-cols-[minmax(0,2fr)_minmax(360px,1fr)]">
          <div className="flex min-h-dvh min-w-0 flex-col bg-[linear-gradient(180deg,#ffffff_0%,#ffffff_76%,#f6fbf8_100%)]">
            <div className="flex justify-end px-3 pt-3 sm:px-8"><LanguageSwitcher /></div>
            <main className="flex min-w-0 flex-1 justify-center px-3 py-6 sm:px-8 sm:py-8 lg:px-10 lg:py-12">
              <div className={`w-full ${isWide ? 'max-w-4xl' : 'max-w-xl self-center'}`}>
                <Outlet />
              </div>
            </main>
            <footer className="px-4 py-5 text-center text-xs leading-5 text-slate-400 sm:px-6">
              © {new Date().getFullYear()} {siteName}. {m.employer_workspace_auth_footer_tagline()}
            </footer>
          </div>
          <HiringFunnelVisual />
        </div>
      </GoogleReCaptchaProvider>
    </ConfigProvider>
  )
}
