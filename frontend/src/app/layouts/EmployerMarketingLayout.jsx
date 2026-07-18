import { useState } from 'react'
import { MenuOutlined, PhoneOutlined } from '@ant-design/icons'
import { Button, Drawer } from 'antd'
import { useTranslation } from 'react-i18next'
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom'
import '@/shared/config/i18n'
import { EmailVerificationBanner } from '@/features/auth'
import { FloatingConsultButton } from '@/features/request-consultation'
import { LanguageSwitcher } from '@/features/switch-language'
import { useSession } from '@/entities/session'
import { BrandLogo, settingText, useSiteSettings } from '@/entities/site-settings'
import { EmployerFooter } from '@/widgets/employer-footer'
import { employerAppPath, employerMarketingPath, HOME_BY_ROLE } from '@/shared/config/portals'

const NAV_ITEMS = [
  { key: 'home', to: employerMarketingPath(''), end: true },
  { key: 'about', to: employerMarketingPath('/gioi-thieu') },
  { key: 'services', to: employerMarketingPath('/dich-vu') },
  { key: 'pricing', to: employerMarketingPath('/bao-gia') },
  { key: 'contact', to: employerMarketingPath('/lien-he') },
]

function NavLinks({ className, onNavigate }) {
  const { t } = useTranslation('employer')
  return (
    <nav className={className}>
      {NAV_ITEMS.map((item) => (
        <NavLink
          key={item.key}
          to={item.to}
          end={item.end}
          onClick={onNavigate}
          className={({ isActive }) => (
            isActive
              ? 'relative cursor-pointer font-bold !text-[var(--brand-primary)] after:absolute after:-bottom-2 after:left-0 after:h-0.5 after:w-full after:rounded-full after:bg-[var(--brand-primary)]'
              : 'relative cursor-pointer font-semibold !text-slate-600 transition-colors hover:!text-[var(--brand-primary)]'
          )}
        >
          {t(`nav.${item.key}`)}
        </NavLink>
      ))}
    </nav>
  )
}

export default function EmployerMarketingLayout() {
  const { t } = useTranslation('employer')
  const { isAuthenticated, user } = useSession()
  const { settings } = useSiteSettings()
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)

  const hotline = settingText(settings.employer_hotline_north, settingText(settings.hotline))
  const isEmployer = isAuthenticated && user?.role === 'employer'
  const closeMenu = () => setMenuOpen(false)

  const authButtons = isEmployer ? (
    <Button type="primary" shape="round" onClick={() => { closeMenu(); navigate(HOME_BY_ROLE.employer) }}>
      {t('nav.goToDashboard')}
    </Button>
  ) : (
    <>
      <Link to={employerAppPath('/login')} onClick={closeMenu}>
        <Button shape="round">{t('nav.login')}</Button>
      </Link>
      <Link to={employerAppPath('/register')} onClick={closeMenu}>
        <Button type="primary" shape="round">{t('nav.postJob')}</Button>
      </Link>
    </>
  )

  return (
    <div className="min-h-screen bg-white text-gray-900">
      <header className="sticky top-0 z-30 border-b border-gray-100 bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-8">
            <BrandLogo to={employerMarketingPath('')} variant="full" className="flex items-center" imageClassName="h-9 max-w-[190px]" />
            <NavLinks className="hidden items-center gap-7 text-sm lg:flex" />
          </div>

          <div className="flex items-center gap-2">
            {hotline && (
              <a
                href={`tel:${hotline.replace(/[^+\d]/g, '')}`}
                className="hidden items-center gap-1.5 text-sm font-bold text-[var(--brand-primary)] xl:flex"
              >
                <PhoneOutlined /> {hotline}
              </a>
            )}
            <span className="hidden sm:block"><LanguageSwitcher /></span>
            <div className="hidden items-center gap-2 md:flex">{authButtons}</div>
            <button
              type="button"
              aria-label={t('nav.openMenu')}
              onClick={() => setMenuOpen(true)}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-gray-200 text-gray-600 lg:hidden"
            >
              <MenuOutlined />
            </button>
          </div>
        </div>
      </header>

      <Drawer open={menuOpen} onClose={closeMenu} size={300} title={<BrandLogo to={employerMarketingPath('')} variant="full" imageClassName="h-8 max-w-[160px]" />}>
        <NavLinks className="flex flex-col gap-5 text-base text-gray-700" onNavigate={closeMenu} />
        <div className="mt-8 flex flex-col gap-3 [&_.ant-btn]:w-full">{authButtons}</div>
        <div className="mt-8 flex items-center justify-between border-t border-gray-100 pt-5">
          {hotline && (
            <a href={`tel:${hotline.replace(/[^+\d]/g, '')}`} className="flex items-center gap-1.5 text-sm font-bold text-[var(--brand-primary)]">
              <PhoneOutlined /> {hotline}
            </a>
          )}
          <LanguageSwitcher />
        </div>
      </Drawer>

      <EmailVerificationBanner verificationPath={employerAppPath('/xac-thuc-email')} />

      <main>
        <Outlet />
      </main>

      <FloatingConsultButton />
      <EmployerFooter />
    </div>
  )
}
