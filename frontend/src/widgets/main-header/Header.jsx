import { MenuOutlined } from '@ant-design/icons'
import { App, Button } from 'antd'
import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { EMPLOYER_PORTAL_URL, HOME_BY_ROLE } from '@/shared/config/portals'
import { useAuth, useLoginPrompt } from '@/features/auth'
import { useHideOnScroll } from '@/shared/hooks/useHideOnScroll'
import BrandLogo from '../../components/brand/BrandLogo'
import CandidateUserMenu from './CandidateUserMenu'
import { DesktopNavigation, MobileNavigation } from './HeaderNavigation'
import { HEADER_NAVIGATION } from './headerNavigationConfig'

function GuestActions({ mobile = false, onSelect, onLogin }) {
  // Đăng nhập mở popup tại trang hiện tại (giữ ngữ cảnh) thay vì sang /login.
  function handleLogin() {
    onSelect?.()
    onLogin()
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
      <Link to="/sign-up" className="hidden cursor-pointer sm:inline-block"><Button className="cursor-pointer" shape="round">Đăng ký</Button></Link>
      <Button className="cursor-pointer" type="primary" shape="round" onClick={handleLogin}>Đăng nhập</Button>
      <a href={EMPLOYER_PORTAL_URL} className="hidden cursor-pointer lg:inline-block">
        <Button className="cursor-pointer" ghost type="primary" shape="round">Đăng tuyển &amp; tìm hồ sơ</Button>
      </a>
    </>
  )
}

function HeaderActions({ isAuthenticated, logout, navigate, user, onLogin }) {
  if (!isAuthenticated) return <GuestActions onLogin={onLogin} />
  if (user?.role === 'candidate') {
    return (
      <>
        <CandidateUserMenu user={user} logout={logout} />
        <div className="hidden border-l border-gray-200 pl-4 leading-tight lg:block">
          <p className="text-xs text-gray-500">Bạn là nhà tuyển dụng?</p>
          <a href={EMPLOYER_PORTAL_URL} className="text-sm font-semibold text-[var(--brand-primary)] hover:underline">
            Đăng tuyển ngay »
          </a>
        </div>
      </>
    )
  }
  return (
    <>
      <Button className="cursor-pointer" onClick={() => navigate(HOME_BY_ROLE[user?.role] || '/')}>Trang quản lý</Button>
      <Button className="cursor-pointer" onClick={logout}>Đăng xuất</Button>
    </>
  )
}

function MobileActions({ isAuthenticated, navigate, onClose, user, onLogin }) {
  return (
    <div className="flex flex-col gap-2 p-5">
      {!isAuthenticated ? (
        <GuestActions mobile onSelect={onClose} onLogin={onLogin} />
      ) : user?.role === 'candidate' ? (
        <a href={EMPLOYER_PORTAL_URL} className="text-center text-sm font-semibold text-[var(--brand-primary)]">
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

export default function Header() {
  const { user, isAuthenticated, logout } = useAuth()
  const { promptLogin } = useLoginPrompt()
  const navigate = useNavigate()
  const location = useLocation()
  const { message } = App.useApp()
  const [openKey, setOpenKey] = useState(null)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [mobileKey, setMobileKey] = useState(null)
  const headerVisible = useHideOnScroll()
  const hideOnScroll = location.pathname === '/viec-lam'
    || location.pathname === '/jobs'
    || location.pathname.startsWith('/viec-lam/tai/')
    || (location.pathname.startsWith('/viec-lam/') && location.pathname !== '/viec-lam-da-luu')
    || location.pathname.includes('/tuyen-dung/')
  const shouldShowHeader = !hideOnScroll || headerVisible

  function handleItem(item) {
    setOpenKey(null)
    setMobileOpen(false)
    // Việc làm đã lưu yêu cầu đăng nhập — khách mở popup tại chỗ thay vì bị
    // trang đó đá về /login.
    if (item.action === 'saved-jobs') {
      if (isAuthenticated) navigate('/viec-lam-da-luu')
      else promptLogin(() => navigate('/viec-lam-da-luu'))
    }
    else if (item.to) navigate(item.to)
    else if (item.search) navigate(`/viec-lam?search=${encodeURIComponent(item.search)}`)
    else message.info('Tính năng sẽ sớm ra mắt.')
  }

  return (
    <header className={`sticky top-0 z-30 border-b border-gray-200 bg-white transition-transform duration-300 ${shouldShowHeader ? 'translate-y-0' : '-translate-y-full'}`}>
      <div className="flex h-16 w-full items-center gap-3 px-4 sm:px-6 md:gap-8">
        <button
          type="button"
          aria-label="Mở menu"
          onClick={() => setMobileOpen(true)}
          className="-ml-1 flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-lg text-xl text-gray-600 hover:bg-gray-100 md:hidden"
        >
          <MenuOutlined />
        </button>
        <BrandLogo variant="full" className="cursor-pointer whitespace-nowrap" imageClassName="h-8 max-w-[150px] sm:h-9 sm:max-w-[190px]" />
        <DesktopNavigation
          menus={HEADER_NAVIGATION}
          openKey={openKey}
          pathname={location.pathname}
          onOpen={setOpenKey}
          onSelect={handleItem}
        />
        <div className="ml-auto flex items-center gap-4">
          <HeaderActions
            isAuthenticated={isAuthenticated}
            logout={logout}
            navigate={navigate}
            user={user}
            onLogin={promptLogin}
          />
        </div>
      </div>

      <MobileNavigation
        menus={HEADER_NAVIGATION}
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
          onLogin={promptLogin}
        />
      </MobileNavigation>
    </header>
  )
}
