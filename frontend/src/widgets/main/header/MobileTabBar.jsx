import {
  FileAddOutlined, FileSearchOutlined, HomeFilled, HomeOutlined, ReadFilled, ReadOutlined, UserOutlined,
} from '@ant-design/icons'
import { Avatar, Button } from 'antd'
import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router'
import { useLoginPrompt } from '@/features/common/account/auth'
import { ACCOUNT_ROOT } from '@/entities/account/account'
import { useSession } from '@/entities/account/session'
import { EMPLOYER_PORTAL_URL, HOME_BY_ROLE } from '@/shared/config/portals'
import BottomSheet from '@/shared/ui/BottomSheet'
import { CandidateAccountPanel } from './CandidateUserMenu'
import { HEADER_NAVIGATION, isMenuActive } from './header-navigation-config'
import { m } from '@/shared/config/i18n'

const [JOBS_MENU, CV_MENU] = HEADER_NAVIGATION
const BODY_CLASS = 'has-mobile-tab-bar'

const TABS = [
  { key: 'home', label: m.candidate_tab_home(), to: '/', icon: <HomeOutlined />, activeIcon: <HomeFilled />, isActive: (path) => path === '/' },
  { key: 'jobs', label: m.candidate_tab_jobs(), to: JOBS_MENU.to, icon: <FileSearchOutlined />, isActive: (path) => isMenuActive(JOBS_MENU, path) },
  { key: 'cv', label: m.candidate_tab_create_cv(), to: CV_MENU.to, featured: true, isActive: (path) => isMenuActive(CV_MENU, path) },
  { key: 'handbook', label: m.candidate_tab_handbook(), to: '/blog', icon: <ReadOutlined />, activeIcon: <ReadFilled />, isActive: (path) => path.startsWith('/blog') },
]

const tabClass = (active) => `flex h-full flex-col items-center justify-center gap-0.5 text-[11px] leading-4 transition-colors ${
  active ? 'font-semibold !text-[var(--brand-primary)]' : 'font-medium !text-slate-500'
}`

function FeaturedTab({ tab, active }) {
  return (
    <Link to={tab.to} aria-current={active ? 'page' : undefined} className={`${tabClass(active)} justify-end pb-[13px]`}>
      <span aria-hidden className="absolute -top-[18px] left-1/2 flex h-14 w-14 -translate-x-1/2 items-center justify-center rounded-full bg-gradient-to-br from-[var(--brand-primary)] to-[var(--brand-primary-hover)] text-2xl text-white shadow-lg shadow-[var(--brand-primary)]/40 transition active:scale-95">
        <FileAddOutlined />
      </span>
      {tab.label}
    </Link>
  )
}

function AccountSheetContent({ user, isAuthenticated, logout, onClose }) {
  const navigate = useNavigate()
  const { promptLogin } = useLoginPrompt()
  const go = (path) => { onClose(); navigate(path) }

  if (user?.role === 'candidate') return <CandidateAccountPanel user={user} logout={logout} onClose={onClose} />
  if (isAuthenticated) {
    return (
      <div className="flex flex-col gap-2 p-4">
        <Button block size="large" shape="round" type="primary" onClick={() => go(HOME_BY_ROLE[user?.role] || '/')}>{m.candidate_account_dashboard()}</Button>
        <Button block size="large" shape="round" onClick={() => { onClose(); logout() }}>{m.candidate_account_logout()}</Button>
      </div>
    )
  }
  return (
    <div className="flex flex-col gap-2 p-4">
      <p className="mb-1 text-sm text-slate-500">{m.candidate_account_guest_hint()}</p>
      <Button block size="large" shape="round" type="primary" onClick={() => { onClose(); promptLogin() }}>{m.candidate_account_sign_in()}</Button>
      <Button block size="large" shape="round" onClick={() => go('/sign-up')}>{m.candidate_account_sign_up()}</Button>
      <a href={EMPLOYER_PORTAL_URL} className="mt-1 text-center text-sm font-semibold !text-[var(--brand-primary)]">
        {m.candidate_account_employer_cta()}
      </a>
    </div>
  )
}

/**
 * Thanh điều hướng đáy cho màn hẹp (< md). Ẩn khi trang có thanh hành động
 * riêng (`body.has-bottom-action-bar`); gắn `body.has-mobile-tab-bar` để nút
 * nổi và dock so sánh tự nâng lên qua `--page-bottom-bar-height`.
 */
export default function MobileTabBar() {
  const { pathname } = useLocation()
  const { user, isAuthenticated, logout } = useSession()
  const [accountOpen, setAccountOpen] = useState(false)
  const accountActive = accountOpen || pathname.startsWith(ACCOUNT_ROOT)

  useEffect(() => {
    document.body.classList.add(BODY_CLASS)
    return () => document.body.classList.remove(BODY_CLASS)
  }, [])

  useEffect(() => setAccountOpen(false), [pathname])

  return (
    <>
      <div aria-hidden className="mobile-tab-bar h-16 md:hidden" />
      <nav
        aria-label={m.candidate_tab_nav_label()}
        className="mobile-tab-bar fixed inset-x-0 bottom-0 z-40 bg-white pb-[env(safe-area-inset-bottom)] [filter:drop-shadow(0_-2px_8px_rgba(15,23,42,0.08))] md:hidden"
      >
        <span aria-hidden className="absolute -top-[26px] left-1/2 h-[72px] w-[72px] -translate-x-1/2 rounded-full bg-white" />
        <ul className="relative grid h-16 grid-cols-5">
          {TABS.map((tab) => {
            const active = tab.isActive(pathname)
            return (
              <li key={tab.key} className="relative">
                {tab.featured ? <FeaturedTab tab={tab} active={active} /> : (
                  <Link to={tab.to} aria-current={active ? 'page' : undefined} className={tabClass(active)}>
                    <span aria-hidden className="text-xl leading-none">{active && tab.activeIcon ? tab.activeIcon : tab.icon}</span>
                    {tab.label}
                  </Link>
                )}
              </li>
            )
          })}
          <li>
            <button
              type="button"
              aria-haspopup="dialog"
              aria-expanded={accountOpen}
              onClick={() => setAccountOpen(true)}
              className={`${tabClass(accountActive)} w-full cursor-pointer`}
            >
              {isAuthenticated ? (
                <Avatar
                  aria-hidden
                  size={22}
                  src={user?.avatar_url || undefined}
                  icon={<UserOutlined />}
                  className={accountActive ? 'ring-2 ring-[var(--brand-primary)]' : ''}
                />
              ) : <span aria-hidden className="text-xl leading-none"><UserOutlined /></span>}
              {m.candidate_tab_account()}
            </button>
          </li>
        </ul>
      </nav>

      <BottomSheet
        open={accountOpen}
        onClose={() => setAccountOpen(false)}
        title={<span className="text-base font-bold text-slate-800">{m.candidate_tab_account()}</span>}
      >
        <AccountSheetContent
          user={user}
          isAuthenticated={isAuthenticated}
          logout={logout}
          onClose={() => setAccountOpen(false)}
        />
      </BottomSheet>
    </>
  )
}
