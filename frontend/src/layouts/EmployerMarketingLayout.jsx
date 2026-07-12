import { Button } from 'antd'
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom'
import { EmailVerificationBanner, useAuth } from '@/features/auth'
import BrandLogo from '../components/brand/BrandLogo'
import { employerAppPath, employerMarketingPath, HOME_BY_ROLE } from '../config/portals'

const NAV_ITEMS = [
  { label: 'Trang chủ', to: employerMarketingPath('') },
  { label: 'Dịch vụ', to: employerMarketingPath('/dich-vu') },
  { label: 'Báo giá', to: employerMarketingPath('/bao-gia') },
]

export default function EmployerMarketingLayout() {
  const { isAuthenticated, user } = useAuth()
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-white text-gray-900">
      <header className="sticky top-0 z-30 border-b border-gray-100 bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <BrandLogo to={employerMarketingPath('')} variant="full" className="flex items-center" imageClassName="h-9 max-w-[190px]" />

          <nav className="hidden items-center gap-7 text-sm font-semibold text-gray-600 md:flex">
            {NAV_ITEMS.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === employerMarketingPath('')}
                className={({ isActive }) => (
                  isActive ? 'text-[var(--brand-primary)]' : 'transition hover:text-[var(--brand-primary)]'
                )}
              >
                {item.label}
              </NavLink>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            {isAuthenticated && user?.role === 'employer' ? (
              <Button type="primary" shape="round" onClick={() => navigate(HOME_BY_ROLE.employer)}>
                Vào trang quản lý
              </Button>
            ) : (
              <>
                <Link to={employerAppPath('/login')}>
                  <Button shape="round">Đăng nhập</Button>
                </Link>
                <Link to={employerAppPath('/register')} className="hidden sm:inline-flex">
                  <Button type="primary" shape="round">Đăng ký</Button>
                </Link>
              </>
            )}
          </div>
        </div>
      </header>
      <EmailVerificationBanner verificationPath={employerAppPath('/xac-thuc-email')} />

      <main>
        <Outlet />
      </main>

      <footer className="border-t border-gray-100 bg-gray-50">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-8 text-sm text-gray-500 sm:px-6 md:flex-row md:items-center md:justify-between lg:px-8">
          <span>ProCV for Employers</span>
          <span>Nền tảng đăng tuyển và quản lý ứng viên dành cho doanh nghiệp.</span>
        </div>
      </footer>
    </div>
  )
}
