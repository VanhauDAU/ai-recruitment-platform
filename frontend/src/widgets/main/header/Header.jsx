import { AppstoreOutlined, SearchOutlined } from '@ant-design/icons'
import { Button } from 'antd'
import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router'
import { EMPLOYER_PORTAL_URL, HOME_BY_ROLE } from '@/shared/config/portals'
import { useLoginPrompt } from '@/features/common/account/auth'
import { useSession } from '@/entities/account/session'
import { useHideOnScroll } from '@/shared/hooks/use-hide-on-scroll'
import { BrandLogo, useSiteSettings } from '@/entities/system/site-settings'
import CandidateUserMenu from './CandidateUserMenu'
import { DesktopNavigation, MobileNavigation } from './HeaderNavigation'
import { HEADER_NAVIGATION, navigationForCapabilities } from './header-navigation-config'
import { useHeaderNavigationSources } from './use-header-navigation-sources'
import { m } from '@/shared/config/i18n'

function GuestActions({ mobile = false, compactMobile = false, onSelect, navigate }) {
  // Đăng nhập chuyển sang trang /login.
  function handleLogin() {
    onSelect?.()
    navigate('/login')
  }
  if (mobile) {
    return (
      <>
        <Button block type="primary" shape="round" onClick={handleLogin}>Đăng nhập</Button>
        <Link to="/sign-up" onClick={onSelect}><Button block shape="round">Đăng ký</Button></Link>
        <a href={EMPLOYER_PORTAL_URL}><Button block ghost type="primary" shape="round">Đăng tuyển &amp; tìm hồ sơ</Button></a>
      </>
    )
  }
  return (
    <>
      <Link to="/sign-up" className={`hidden cursor-pointer ${compactMobile ? 'md:inline-block' : 'sm:inline-block'}`}><Button className="cursor-pointer" shape="round">Đăng ký</Button></Link>
      <Button className={`cursor-pointer ${compactMobile ? '!hidden md:!inline-flex' : ''}`} type="primary" shape="round" onClick={handleLogin}>Đăng nhập</Button>
      <a href={EMPLOYER_PORTAL_URL} className="hidden cursor-pointer lg:inline-block">
        <Button className="cursor-pointer" ghost type="primary" shape="round">Đăng tuyển &amp; tìm hồ sơ</Button>
      </a>
    </>
  )
}

function HeaderActions({ compactMobile, isAuthenticated, logout, navigate, user }) {
  if (!isAuthenticated) return <GuestActions compactMobile={compactMobile} navigate={navigate} />
  if (user?.role === 'candidate') {
    return (
      <>
        <CandidateUserMenu user={user} logout={logout} compactMobile={compactMobile} />
        <div className="hidden border-l border-gray-200 pl-4 leading-tight lg:block">
          <p className="text-xs text-gray-500">Bạn là nhà tuyển dụng?</p>
          <a href={EMPLOYER_PORTAL_URL} className="text-sm font-semibold !text-[var(--brand-primary)] transition-colors hover:!text-[var(--brand-primary-hover)] hover:underline">
            Đăng tuyển ngay »
          </a>
        </div>
      </>
    )
  }
  return (
    <div className={compactMobile ? 'hidden gap-2 md:flex' : 'flex gap-2'}>
      <Button className="cursor-pointer" onClick={() => navigate(HOME_BY_ROLE[user?.role] || '/')}>Trang quản lý</Button>
      <Button className="cursor-pointer" onClick={logout}>Đăng xuất</Button>
    </div>
  )
}

function MobileActions({ isAuthenticated, navigate, onClose, user }) {
  return (
    <div className="flex flex-col gap-2 p-5">
      {!isAuthenticated ? (
        <GuestActions mobile onSelect={onClose} navigate={navigate} />
      ) : user?.role === 'candidate' ? (
        <a href={EMPLOYER_PORTAL_URL} className="text-center text-sm font-semibold !text-[var(--brand-primary)] transition-colors hover:!text-[var(--brand-primary-hover)]">
          Bạn là nhà tuyển dụng? Đăng tuyển ngay »
        </a>
      ) : (
        <Button block onClick={() => { onClose(); navigate(HOME_BY_ROLE[user?.role] || '/') }}>
          Trang quản lý
        </Button>
      )}
    </div>
  )
}

export default function Header({ editorMode = false }) {
  const { user, isAuthenticated, logout } = useSession()
  const { promptLogin } = useLoginPrompt()
  const { settings } = useSiteSettings()
  const navigate = useNavigate()
  const location = useLocation()
  const [openKey, setOpenKey] = useState(null)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [mobileKey, setMobileKey] = useState(null)
  const headerVisible = useHideOnScroll()
  const [menuTouched, setMenuTouched] = useState(false)
  if (!menuTouched && (openKey || mobileOpen)) setMenuTouched(true)
  const sources = useHeaderNavigationSources(menuTouched)
  const menus = navigationForCapabilities(HEADER_NAVIGATION, {
    knowledgebaseEnabled: settings.knowledgebase_public_enabled === true,
    nearbyJobsEnabled: settings.nearby_jobs_enabled !== false,
    sources,
  })
  const hideOnScroll = location.pathname === '/viec-lam'
    || location.pathname === '/jobs'
    || location.pathname.startsWith('/viec-lam/tai/')
    || (location.pathname.startsWith('/viec-lam/') && location.pathname !== '/viec-lam-da-luu')
    || location.pathname.includes('/tuyen-dung/')
    // The CV editor has long, form-heavy pages. Hide the global sticky header
    // while scrolling there so it cannot cover controls on small viewports.
    || location.pathname.startsWith('/cvs/')
  const isCvRoute = location.pathname.startsWith('/cvs/')
  const shouldShowHeader = editorMode || (!isCvRoute && (!hideOnScroll || headerVisible))

  function handleItem(item) {
    setOpenKey(null)
    setMobileOpen(false)
    // Trang cần đăng nhập: khách mở popup tại chỗ thay vì bị đá về /login.
    if (item.requiresAuth && !isAuthenticated) promptLogin(() => navigate(item.to))
    else navigate(item.to)
  }

  return (
    <header aria-label={editorMode ? 'Header website' : undefined} className={`sticky top-0 z-50 shrink-0 border-b border-gray-200 bg-white transition-transform duration-300 ${editorMode ? 'border-t-2 border-t-slate-800' : ''} ${shouldShowHeader ? 'translate-y-0' : '-translate-y-full'}`}>
      <div className="flex h-16 w-full items-center gap-2 px-4 sm:px-6 md:gap-8">
        <BrandLogo variant="full" className="shrink-0 cursor-pointer whitespace-nowrap" imageClassName="h-7 max-w-[112px] sm:h-9 sm:max-w-[190px]" />
        <button
          type="button"
          aria-label={m.candidate_header_open_categories()}
          onClick={() => setMobileOpen(true)}
          className="flex h-9 shrink-0 cursor-pointer items-center gap-1.5 rounded-full bg-[var(--brand-primary-soft)] px-3 text-sm font-semibold text-[var(--brand-primary)] transition active:scale-95 md:hidden"
        >
          <AppstoreOutlined aria-hidden /> {m.candidate_header_categories()}
        </button>
        <DesktopNavigation
          menus={menus}
          openKey={openKey}
          pathname={location.pathname}
          onOpen={setOpenKey}
          onSelect={handleItem}
        />
        <div className="ml-auto flex items-center gap-1 md:gap-4">
          <button
            type="button"
            aria-label={m.candidate_header_search_jobs()}
            onClick={() => navigate('/viec-lam')}
            className="flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-full text-xl text-slate-600 transition hover:bg-slate-100 md:hidden"
          >
            <SearchOutlined />
          </button>
          <HeaderActions
            compactMobile={!editorMode}
            isAuthenticated={isAuthenticated}
            logout={logout}
            navigate={navigate}
            user={user}
          />
        </div>
      </div>

      <MobileNavigation
        menus={menus}
        open={mobileOpen}
        openKey={mobileKey}
        onClose={() => setMobileOpen(false)}
        onOpen={setMobileKey}
        onSelect={handleItem}
      >
        <MobileActions
          isAuthenticated={isAuthenticated}
          navigate={navigate}
          onClose={() => setMobileOpen(false)}
          user={user}
        />
      </MobileNavigation>
    </header>
  )
}
