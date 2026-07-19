import {
  BankOutlined,
  FileProtectOutlined,
  LockOutlined,
  SafetyCertificateOutlined,
  SettingOutlined,
  SolutionOutlined,
  UserOutlined,
} from '@ant-design/icons'
import { Select, Tooltip } from 'antd'
import { useEffect } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import {
  EMPLOYER_ACCOUNT_SETTINGS_URL,
  EMPLOYER_BUSINESS_LICENSE_URL,
  EMPLOYER_COMPANY_SETTINGS_URL,
  EMPLOYER_DATA_PROTECTION_URL,
  EMPLOYER_GENERAL_SETTINGS_URL,
  EMPLOYER_PASSWORD_SETTINGS_URL,
  EMPLOYER_RECRUITMENT_DEMAND_URL,
} from '@/shared/config/portals'
import { setDocumentTitle } from '@/shared/config/document-title'

const ITEMS = [
  { to: EMPLOYER_PASSWORD_SETTINGS_URL, label: 'Đổi mật khẩu', icon: LockOutlined },
  { to: EMPLOYER_ACCOUNT_SETTINGS_URL, label: 'Thông tin tài khoản', icon: UserOutlined },
  { to: EMPLOYER_BUSINESS_LICENSE_URL, label: 'Giấy đăng ký doanh nghiệp', icon: FileProtectOutlined },
  { to: EMPLOYER_DATA_PROTECTION_URL, label: 'Văn bản xử lý Dữ liệu cá nhân', icon: SafetyCertificateOutlined },
  { to: EMPLOYER_COMPANY_SETTINGS_URL, label: 'Thông tin công ty', icon: BankOutlined },
  { to: EMPLOYER_RECRUITMENT_DEMAND_URL, label: 'Nhu cầu tuyển dụng', icon: SolutionOutlined },
  { to: EMPLOYER_GENERAL_SETTINGS_URL, label: 'Cài đặt', icon: SettingOutlined },
]

export default function EmployerAccountSettingsShell({ title, children, hideHeading = false }) {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const activeItem = ITEMS.find((item) => item.to === pathname)

  useEffect(() => {
    setDocumentTitle(title, { portal: 'employer' })
  }, [title])

  return (
    <div className="mx-auto max-w-[1256px] overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className="grid min-w-0 items-stretch xl:grid-cols-[275px_minmax(0,1fr)]">
        <nav aria-label="Cài đặt tài khoản nhà tuyển dụng" className="border-b border-slate-200 bg-slate-50/80 p-3 xl:border-b-0 xl:border-r xl:p-2">
          <div className="xl:hidden">
            <label htmlFor="employer-settings-section" className="mb-1.5 block text-xs font-semibold text-slate-500">Mục cài đặt</label>
            <Select
              id="employer-settings-section"
              aria-label="Chọn mục cài đặt"
              value={activeItem?.to}
              placeholder="Chọn mục cài đặt"
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
                  <Tooltip key={item.label} title="Chức năng sẽ được mở trong giai đoạn tiếp theo">
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
                  className={`flex h-12 items-center gap-3 rounded-sm border-l-2 px-3 text-sm transition ${active ? 'border-emerald-500 bg-white font-bold !text-emerald-600 shadow-sm ring-1 ring-slate-200' : 'border-transparent font-semibold !text-slate-900 hover:bg-white'}`}
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
