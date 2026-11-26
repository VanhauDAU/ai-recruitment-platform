import { Button } from 'antd'
import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router'
import { EMPLOYER_PORTAL_URL, HOME_BY_ROLE } from '@/shared/config/portals'
import { useLoginPrompt } from '@/features/common/account/auth'
import { useSession } from '@/entities/account/session'
import { useHideOnScroll } from '@/shared/hooks/use-hide-on-scroll'
import { useMediaQuery } from '@/shared/hooks/use-media-query'
import { holdKeyboardFocus } from '@/shared/lib/hold-keyboard-focus'
import { BrandLogo, useSiteSettings } from '@/entities/system/site-settings'
import LineIcon from '@/shared/ui/icons/LineIcon'
import CandidateUserMenu from './CandidateUserMenu'
import { DesktopNavigation, MobileNavigation } from './HeaderNavigation'
import { HEADER_NAVIGATION, navigationForCapabilities } from '../model/header-navigation-config'
import { detailBackFallback } from '../model/detail-back'
import { useHeaderNavigationSources } from '../model/use-header-navigation-sources'
import { m } from '@/shared/config/i18n'

const CV_EDITOR_PATH = /^\/cv\/[^/]+\/chinh-sua\/?$/

function GuestActions({ mobile = false, compactMobile = false, onSelect, navigate }) {
  // Đăng nhập chuyển sang trang /login.
  function handleLogin() {
    onSelect?.()
    navigate('/dang-nhap')
  }
  if (mobile) {
    return (
      <>
        <Button block type="primary" shape="round" onClick={handleLogin}>Đăng nhập</Button>
        <Link to="/dang-ky" onClick={onSelect}><Button block shape="round">Đăng ký</Button></Link>
        <a href={EMPLOYER_PORTAL_URL}><Button block ghost type="primary" shape="round">Đăng tuyển &amp; tìm hồ sơ</Button></a>
      </>
    )
  }
  return (
    <>
      <Link to="/dang-ky" className={`hidden cursor-pointer ${compactMobile ? 'md:inline-block' : 'sm:inline-block'}`}><Button className="cursor-pointer" shape="round">Đăng ký</Button></Link>
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

// Danh sách việc làm (kể cả theo địa điểm), không gồm trang chi tiết tin.
const JOB_LIST_PATH = /^\/(viec-lam(\/tai\/[^/]+)?|jobs)\/?$/

export default function Header({ editorMode = false }) {
  const { user, isAuthenticated, logout } = useSession()
  const { promptLogin } = useLoginPrompt()
  const { settings } = useSiteSettings()
  const navigate = useNavigate()
  const location = useLocation()
  const [openKey, setOpenKey] = useState(null)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [mobileKey, setMobileKey] = useState(null)
  // Điện thoại: trang danh sách việc làm chỉ hiện header ở đầu trang (nhường chỗ cho
  // kết quả); trang chi tiết giữ header luôn dính vì có nút quay lại. Desktop: ẩn khi
  // cuộn xuống, hiện khi cuộn lên trên các trang việc làm.
  const isPhone = useMediaQuery('(max-width: 767.98px)')
  const isJobList = JOB_LIST_PATH.test(location.pathname)
  const headerVisible = useHideOnScroll(96, { topOnly: isPhone && isJobList })
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
    || CV_EDITOR_PATH.test(location.pathname)
  const isCvRoute = CV_EDITOR_PATH.test(location.pathname)
  const backFallback = editorMode ? null : detailBackFallback(location.pathname)

  // `key === 'default'`: trang đầu tiên của phiên (link chia sẻ, tab mới) — không có
  // trang trước trong app để lùi, về danh sách thay vì rời site.
  function goBack() {
    if (location.key === 'default') navigate(backFallback)
    else navigate(-1)
  }
  const shouldShowHeader = editorMode || (!isCvRoute && ((isPhone && !isJobList) || !hideOnScroll || headerVisible))

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
        {backFallback && (
          <button
            type="button"
            aria-label={m.candidate_header_back()}
            onClick={goBack}
            className="-ml-2 flex h-10 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full text-xl text-slate-700 transition active:scale-95 md:hidden"
          >
            <LineIcon name="arrowLeft" />
          </button>
        )}
        <BrandLogo variant="full" className="shrink-0 cursor-pointer whitespace-nowrap" imageClassName="h-7 max-w-[112px] sm:h-9 sm:max-w-[190px]" />
        {/* Trình chỉnh sửa CV trên điện thoại cần chỗ cho chuông, tin nhắn, avatar. */}
        {!editorMode && <button
          type="button"
          aria-label={m.candidate_header_open_categories()}
          onClick={() => setMobileOpen(true)}
          className="flex h-9 shrink-0 cursor-pointer items-center gap-1.5 rounded-full bg-[var(--brand-primary-soft)] pl-2.5 pr-3 text-sm font-semibold text-[var(--brand-primary-hover)] transition active:scale-95 md:hidden"
        >
          <LineIcon name="layoutGrid" className="text-base" /> {m.candidate_header_categories()}
        </button>}
        <DesktopNavigation
          menus={menus}
          openKey={openKey}
          pathname={location.pathname}
          onOpen={setOpenKey}
          onSelect={handleItem}
        />
        <div className="ml-auto flex items-center gap-1 md:gap-4">
          {!editorMode && <button
            type="button"
            aria-label={m.candidate_header_search_jobs()}
            onClick={() => {
              holdKeyboardFocus()
              navigate('/viec-lam', { state: { focusSearch: Date.now() } })
            }}
            className="flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-full text-[22px] text-slate-700 transition hover:bg-slate-100 active:scale-95 md:hidden"
          >
            <LineIcon name="search" strokeWidth={1.8} />
          </button>}
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
