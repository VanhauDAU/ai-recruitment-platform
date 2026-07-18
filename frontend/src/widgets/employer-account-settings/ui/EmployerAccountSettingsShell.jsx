import { BankOutlined, FileProtectOutlined, LockOutlined, SafetyCertificateOutlined } from '@ant-design/icons'
import { Link, useLocation } from 'react-router-dom'
import {
  EMPLOYER_BUSINESS_LICENSE_URL,
  EMPLOYER_COMPANY_SETTINGS_URL,
  EMPLOYER_DATA_PROTECTION_URL,
  EMPLOYER_PASSWORD_SETTINGS_URL,
} from '@/shared/config/portals'

const ITEMS = [
  { to: EMPLOYER_PASSWORD_SETTINGS_URL, label: 'Đổi mật khẩu', icon: LockOutlined },
  { to: EMPLOYER_COMPANY_SETTINGS_URL, label: 'Thông tin công ty', icon: BankOutlined },
  { to: EMPLOYER_BUSINESS_LICENSE_URL, label: 'Giấy đăng ký doanh nghiệp', icon: FileProtectOutlined },
  { to: EMPLOYER_DATA_PROTECTION_URL, label: 'Văn bản xử lý DLCN', icon: SafetyCertificateOutlined },
]

export default function EmployerAccountSettingsShell({ title, description, children }) {
  const { pathname } = useLocation()
  return (
    <div className="mx-auto max-w-6xl">
      <header className="mb-5"><p className="text-xs font-bold uppercase tracking-[.16em] text-emerald-600">Cài đặt tài khoản</p><h1 className="mt-2 text-2xl font-black text-slate-950">{title}</h1>{description && <p className="mt-2 text-sm leading-6 text-slate-500">{description}</p>}</header>
      <div className="grid items-start gap-5 xl:grid-cols-[250px_minmax(0,1fr)]">
        <nav aria-label="Cài đặt tài khoản nhà tuyển dụng" className="overflow-x-auto rounded-2xl border border-slate-200 bg-white p-2 shadow-sm xl:sticky xl:top-0">
          <div className="flex min-w-max gap-1 xl:min-w-0 xl:flex-col">
            {ITEMS.map((item) => {
              const Icon = item.icon
              const active = pathname === item.to
              return <Link key={item.to} to={item.to} className={`flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-bold transition ${active ? 'bg-emerald-50 text-emerald-700' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}`} aria-current={active ? 'page' : undefined}><Icon /> {item.label}</Link>
            })}
          </div>
        </nav>
        <section className="min-w-0 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">{children}</section>
      </div>
    </div>
  )
}
