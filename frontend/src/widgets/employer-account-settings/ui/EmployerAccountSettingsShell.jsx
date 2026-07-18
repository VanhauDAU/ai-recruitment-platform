import { BankOutlined, FileProtectOutlined, LockOutlined, SafetyCertificateOutlined, UserOutlined } from '@ant-design/icons'
import { useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import {
  EMPLOYER_ACCOUNT_SETTINGS_URL,
  EMPLOYER_BUSINESS_LICENSE_URL,
  EMPLOYER_COMPANY_SETTINGS_URL,
  EMPLOYER_DATA_PROTECTION_URL,
  EMPLOYER_PASSWORD_SETTINGS_URL,
} from '@/shared/config/portals'

const ITEMS = [
  { to: EMPLOYER_PASSWORD_SETTINGS_URL, label: 'Đổi mật khẩu', icon: LockOutlined },
  { to: EMPLOYER_ACCOUNT_SETTINGS_URL, label: 'Thông tin tài khoản', icon: UserOutlined },
  { to: EMPLOYER_BUSINESS_LICENSE_URL, label: 'Giấy đăng ký doanh nghiệp', icon: FileProtectOutlined },
  { to: EMPLOYER_DATA_PROTECTION_URL, label: 'Văn bản xử lý Dữ liệu cá nhân', icon: SafetyCertificateOutlined },
  { to: EMPLOYER_COMPANY_SETTINGS_URL, label: 'Thông tin công ty', icon: BankOutlined },
]

export default function EmployerAccountSettingsShell({ title, children }) {
  const { pathname } = useLocation()

  useEffect(() => {
    document.title = `${title} | Smart Recruitment Platform`
  }, [title])

  return (
    <div className="mx-auto max-w-[1256px] overflow-hidden rounded-sm border border-slate-200 bg-white shadow-sm">
      <div className="grid items-stretch xl:grid-cols-[260px_minmax(0,1fr)]">
        <nav aria-label="Cài đặt tài khoản nhà tuyển dụng" className="border-b border-slate-200 bg-slate-50/80 p-2 xl:border-b-0 xl:border-r">
          <div className="flex min-w-max gap-1 overflow-x-auto xl:min-w-0 xl:flex-col xl:overflow-visible">
            {ITEMS.map((item) => {
              const Icon = item.icon
              const active = pathname === item.to
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  aria-current={active ? 'page' : undefined}
                  className={`flex items-center gap-3 rounded-sm border-l-2 px-3 py-3 text-sm transition ${active ? 'border-emerald-500 bg-white font-bold !text-emerald-600 shadow-sm ring-1 ring-slate-200' : 'border-transparent font-semibold !text-slate-900 hover:bg-white'}`}
                >
                  <Icon aria-hidden="true" className="text-base" />
                  <span className="whitespace-nowrap">{item.label}</span>
                </Link>
              )
            })}
          </div>
        </nav>
        <section className="min-w-0 p-5 sm:p-7">
          <header className="mb-5">
            <h1 className="text-base font-semibold text-slate-800">{title}</h1>
          </header>
          {children}
        </section>
      </div>
    </div>
  )
}
