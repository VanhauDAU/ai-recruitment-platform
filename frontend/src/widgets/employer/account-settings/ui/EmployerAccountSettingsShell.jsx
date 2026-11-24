import {
  BankOutlined,
  FileProtectOutlined,
  LockOutlined,
  SafetyCertificateOutlined,
  SettingOutlined,
  ShareAltOutlined,
  SolutionOutlined,
  UserOutlined,
} from '@ant-design/icons'
import { Select, Tooltip } from 'antd'
import { Link, useLocation, useNavigate } from 'react-router'
import {
  EMPLOYER_ACCOUNT_SETTINGS_URL,
  EMPLOYER_BUSINESS_LICENSE_URL,
  EMPLOYER_COMPANY_SETTINGS_URL,
  EMPLOYER_DATA_PROTECTION_URL,
  EMPLOYER_GENERAL_SETTINGS_URL,
  EMPLOYER_INTEGRATIONS_URL,
  EMPLOYER_PASSWORD_SETTINGS_URL,
  EMPLOYER_RECRUITMENT_DEMAND_URL,
} from '@/shared/config/portals'
import { m } from '@/shared/config/i18n'

const ITEMS = [
  { to: EMPLOYER_PASSWORD_SETTINGS_URL, label: m.employer_account_settings_nav_password(), icon: LockOutlined },
  { to: EMPLOYER_ACCOUNT_SETTINGS_URL, label: m.employer_account_settings_nav_account(), icon: UserOutlined },
  { to: EMPLOYER_BUSINESS_LICENSE_URL, label: m.employer_account_docs_business_registration(), icon: FileProtectOutlined },
  { to: EMPLOYER_DATA_PROTECTION_URL, label: m.employer_account_settings_nav_dpa(), icon: SafetyCertificateOutlined },
  { to: EMPLOYER_COMPANY_SETTINGS_URL, label: m.employer_account_settings_nav_company(), icon: BankOutlined },
  { to: EMPLOYER_RECRUITMENT_DEMAND_URL, label: m.employer_account_settings_nav_demand(), icon: SolutionOutlined },
  { to: EMPLOYER_INTEGRATIONS_URL, label: m.employer_account_settings_nav_integrations(), icon: ShareAltOutlined },
  { to: EMPLOYER_GENERAL_SETTINGS_URL, label: m.employer_account_settings_nav_general(), icon: SettingOutlined },
]

export default function EmployerAccountSettingsShell({ title, children, hideHeading = false }) {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const activeItem = ITEMS.find((item) => item.to === pathname)

  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="grid min-w-0 items-stretch xl:grid-cols-[275px_minmax(0,1fr)]">
        <nav aria-label={m.employer_account_settings_nav_aria()} className="border-b border-slate-200 bg-slate-50/80 p-3 xl:border-b-0 xl:border-r xl:p-2">
          <div className="xl:hidden">
            <label htmlFor="employer-settings-section" className="mb-1.5 block text-xs font-semibold text-slate-500">{m.employer_account_settings_section()}</label>
            <Select
              id="employer-settings-section"
              aria-label={m.employer_account_settings_choose_section()}
              value={activeItem?.to}
              placeholder={m.employer_account_settings_choose_section()}
              onChange={(value) => navigate(value)}
              options={ITEMS.map((item) => ({ value: item.to || item.label, label: item.label, disabled: item.disabled }))}
              className="w-full"
              size="large"
            />
          </div>
          <div className="hidden xl:flex xl:min-w-0 xl:flex-col">
            {ITEMS.map((item) => {
              const Icon = item.icon
              if (item.disabled) {
                return (
                  <Tooltip key={item.label} title={m.employer_account_settings_coming_soon()}>
                    <span
                      aria-disabled="true"
                      className="flex h-12 cursor-not-allowed items-center gap-3 rounded-sm border-l-2 border-transparent px-3 text-sm font-semibold text-slate-400"
                    >
                      <Icon aria-hidden="true" className="text-base" />
                      <span className="whitespace-nowrap">{item.label}</span>
                    </span>
                  </Tooltip>
                )
              }
              const active = pathname === item.to
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  aria-current={active ? 'page' : undefined}
                  className={`flex h-12 items-center gap-3 rounded-sm border-l-2 px-3 text-sm transition ${active ? 'border-[var(--brand-primary)] bg-white font-bold !text-[var(--brand-primary)] shadow-sm ring-1 ring-slate-200' : 'border-transparent font-semibold !text-slate-900 hover:bg-white'}`}
                >
                  <Icon aria-hidden="true" className="text-base" />
                  <span className="whitespace-nowrap">{item.label}</span>
                </Link>
              )
            })}
          </div>
        </nav>
        <section className="min-w-0 p-4 sm:p-6 lg:p-7">
          {!hideHeading && (
            <header className="mb-5">
              <h1 className="text-base font-semibold text-slate-800">{title}</h1>
            </header>
          )}
          {children}
        </section>
      </div>
    </div>
  )
}
