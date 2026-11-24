import {
  ArrowLeftOutlined,
  BarChartOutlined,
  FileTextOutlined,
  LogoutOutlined,
  MenuOutlined,
  MessageOutlined,
  PlusOutlined,
  QuestionCircleFilled,
  SearchOutlined,
  SettingOutlined,
} from '@ant-design/icons'
import { Avatar, Button, Dropdown, Layout, Menu, Popover, Tooltip } from 'antd'
import { useEffect, useState } from 'react'
import { Link, Outlet, useLocation, useNavigate } from 'react-router'
import { ANNOUNCEMENT_SURFACES } from '@/entities/content/announcement'
import {
  EMPLOYER_CAPABILITIES,
  employerReadinessAction,
  employerReadinessBlockersFor,
  useEmployerReadiness,
} from '@/entities/account/employer-profile'
import { useSession } from '@/entities/account/session'
import { BrandLogo } from '@/entities/system/site-settings'
import {
  getEmployerAccountVerificationLevel,
  isEmployerVerificationInvalidated,
} from '@/features/employer/account/verify-employer-account'
import { AnnouncementStrip } from '@/widgets/common/announcement-strip'
import { EmployerNotificationBell } from '@/widgets/employer/notification-center'
import {
  EMPLOYER_ACCOUNT_SETTINGS_URL,
  employerAppPath,
} from '@/shared/config/portals'
import { LanguageSwitcher } from '@/features/common/preferences/switch-language'
import { m } from '@/shared/config/i18n'
import EmployerAccountVerificationPopover from './EmployerAccountVerificationPopover'
import useUnreadApplicationCount from './use-unread-application-count'
import {
  employerNavItems,
  employerOpenMenuKey,
  employerRouteTitle,
  employerSelectedMenuKey,
} from './EmployerWorkspaceNavigation'
import '@/shared/ui/workspace-page/workspace-page.css'
import './employer-workspace.css'

const { Header, Sider, Content } = Layout

// Mirrors the employer workspace navigation in TopCV: an expanded work menu
// and a compact, icon-only rail that keeps the current workspace usable.
const EMPLOYER_SIDEBAR_WIDTH = 240
const EMPLOYER_SIDEBAR_COLLAPSED_WIDTH = 64

function TopbarAction({ icon, label, prominent = false, to }) {
  const content = (
    <span
      className={`hidden h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-bold lg:inline-flex ${prominent ? 'border-emerald-500/45 bg-emerald-500/15 text-emerald-300' : 'border-white/10 bg-white/10 text-slate-200'}`}
    >
      {icon}{label}
    </span>
  )
  if (to) {
    return <Link to={to} className="rounded-full transition hover:opacity-90">{content}</Link>
  }
  return (
    <Tooltip title={m.employer_workspace_topbar_coming_tooltip({ label })}>
      <span
        aria-disabled="true"
        className={`hidden h-8 cursor-not-allowed items-center gap-1.5 rounded-full border px-3 text-xs font-bold lg:inline-flex ${prominent ? 'border-emerald-500/45 bg-emerald-500/15 text-emerald-300' : 'border-white/10 bg-white/10 text-slate-200'}`}
      >
        {icon}{label}
      </span>
    </Tooltip>
  )
}

export default function EmployerWorkspaceLayout() {
  const { user, logout } = useSession()
  const { pathname, search, key: locationKey } = useLocation()
  const navigate = useNavigate()
  const [collapsed, setCollapsed] = useState(false)
  const [isSidebarHovered, setIsSidebarHovered] = useState(false)
  const [isMobileViewport, setIsMobileViewport] = useState(false)
  const {
    profile: profileData,
    profileQuery,
    readiness,
    isAccessError,
    isChecking,
  } = useEmployerReadiness()
  const profile = profileData || {}
  const verification = profile.onboarding || {}
  const verificationCase = profile.verification_case || {}
  const effectiveVerification = isEmployerVerificationInvalidated(verificationCase)
    ? { ...verification, business_doc_approved: false, representative_verified: false }
    : verification
  const accountVerificationLevel = getEmployerAccountVerificationLevel(
    verification,
    verificationCase,
    profile.account_verification ?? profile.employer_account_level,
  )
  const candidateBlocker = employerReadinessBlockersFor(
    readiness,
    EMPLOYER_CAPABILITIES.CANDIDATE_DATA,
  )[0]
  const complianceAction = employerReadinessAction(candidateBlocker?.action)
  const showComplianceNotice = !isChecking && !isAccessError && !readiness.candidateDataAccess
  const unreadApplications = useUnreadApplicationCount(Boolean(readiness.candidateDataAccess))
  const initials = (user?.full_name || user?.email || 'NTD').trim().charAt(0).toUpperCase()
  const isCampaignList = pathname === employerAppPath('/campaigns')
  const routeAction = isCampaignList
    ? { to: '/campaigns/new', label: m.employer_workspace_add_campaign() }
    : pathname === employerAppPath('/jobs')
      ? { to: '/jobs/new', label: m.employer_job_list_post_job() }
      : null
  const campaignDetailMatch = pathname.match(new RegExp(`^${employerAppPath('/campaigns')}/(?!new$)([^/]+)$`))
  const isCampaignDetail = Boolean(campaignDetailMatch)
  const jobEditMatch = pathname.match(new RegExp(`^${employerAppPath('/jobs')}/([^/]+)/edit$`))
  const isJobNew = pathname === employerAppPath('/jobs/new')
  const isJobForm = isJobNew || Boolean(jobEditMatch)
  const isApplicationWorkspace = pathname === employerAppPath('/applications')
  const applicationParams = new URLSearchParams(search)
  const applicationJobId = applicationParams.get('job')
  const applicationCampaignId = applicationParams.get('campaign')

  // Quay lại "thông minh": ưu tiên URL trước đó trong lịch sử phiên (đến từ tin
  // hay chiến dịch đều về đúng chỗ). Khi mở trực tiếp/không có lịch sử nội bộ
  // (key === 'default'), lùi về nơi hợp lý thay vì rời khỏi ứng dụng.
  const goBackFromForm = () => {
    if (locationKey && locationKey !== 'default') {
      navigate(-1)
      return
    }
    navigate(jobEditMatch ? `${employerAppPath('/jobs')}/${jobEditMatch[1]}` : employerAppPath('/jobs'))
  }
  const goBackFromApplications = () => {
    if (applicationJobId) {
      navigate(`${employerAppPath('/jobs')}/${encodeURIComponent(applicationJobId)}`)
      return
    }
    if (applicationCampaignId) {
      navigate(`${employerAppPath('/campaigns')}/${encodeURIComponent(applicationCampaignId)}?active_tab=apply_cv`)
    }
  }
  // Opened from the sidebar (no job/campaign) the page is a top-level inbox
  // and shows no back button.
  const applicationBackLabel = applicationJobId
    ? m.employer_workspace_back_to_job_detail()
    : m.employer_workspace_back_to_campaign()
  const sidebarCollapsed = collapsed && (isMobileViewport || !isSidebarHovered)
  const isCompactSidebar = sidebarCollapsed && !isMobileViewport
  // Moving to a CV page opens the "Quản lý CV" dropdown; the icon rail keeps
  // its own hover popup state so collapsing never pops the group open.
  const selectedMenuKey = employerSelectedMenuKey(pathname)
  const [openMenuKey, setOpenMenuKey] = useState(() => employerOpenMenuKey(selectedMenuKey) || '')
  const [popupMenuKey, setPopupMenuKey] = useState('')
  useEffect(() => {
    const groupKey = employerOpenMenuKey(selectedMenuKey)
    if (groupKey) setOpenMenuKey(groupKey)
  }, [selectedMenuKey])
  const menuOpenKey = isCompactSidebar ? popupMenuKey : openMenuKey
  const setMenuOpenKey = isCompactSidebar ? setPopupMenuKey : setOpenMenuKey
  const accountMenu = {
    items: [
      { key: 'settings', label: m.employer_workspace_nav_account_settings(), icon: <SettingOutlined /> },
      { type: 'divider' },
      { key: 'logout', label: m.employer_workspace_sign_out(), icon: <LogoutOutlined />, danger: true },
    ],
    onClick: ({ key }) => {
      if (key === 'settings') navigate(EMPLOYER_ACCOUNT_SETTINGS_URL)
      if (key === 'logout') logout()
    },
  }

  function navigateFromMenu({ key }) {
    navigate(key)
    if (isMobileViewport) setCollapsed(true)
  }

  function handleSidebarBreakpoint(isBroken) {
    setIsMobileViewport(isBroken)
    setIsSidebarHovered(false)
    setCollapsed(isBroken)
  }

  return (
    <Layout data-testid="employer-workspace" className="!flex !h-dvh !min-h-dvh !flex-col !overflow-hidden !bg-[#edf1f5]">
      <Header data-testid="employer-topbar" className="!z-20 !flex !h-14 !shrink-0 !items-center !justify-between !bg-[#1e2f40] !px-3 !leading-none sm:!px-4">
        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
          <Button
            type="text"
            aria-label={collapsed ? m.employer_workspace_expand_menu() : m.employer_workspace_collapse_menu()}
            aria-pressed={!collapsed}
            icon={<MenuOutlined />}
            onClick={() => setCollapsed((current) => !current)}
            className="!text-slate-300 hover:!bg-white/10 hover:!text-white"
          />
          <BrandLogo
            dark
            to={employerAppPath('/dashboard')}
            className="max-w-[138px]"
            imageClassName="h-7 max-w-[126px]"
            textClassName="text-sm"
          />
        </div>

        <div className="flex items-center gap-2">
          <TopbarAction icon={<BarChartOutlined />} label={m.employer_workspace_topbar_market_survey()} prominent />
          <TopbarAction icon={<FileTextOutlined />} label={m.employer_workspace_topbar_post_job()} to={employerAppPath('/jobs/new')} />
          <TopbarAction icon={<SearchOutlined />} label={m.employer_workspace_topbar_search_cv()} />
          <TopbarAction icon={<MessageOutlined />} label="Connect" />
          <LanguageSwitcher className="!border-white/20 !text-white/80 hover:!text-white" />
          <EmployerNotificationBell />
          <Dropdown menu={accountMenu} trigger={['click']} placement="bottomRight">
            <button type="button" className="flex cursor-pointer items-center gap-2 rounded-full border-0 bg-white/10 p-1 pr-2 text-white transition hover:bg-white/15" aria-label={m.employer_workspace_open_account_menu()}>
              <Avatar size={28} src={user?.avatar_url || undefined} className="!bg-slate-100 !font-bold !text-slate-700">{initials}</Avatar>
              <span className="hidden max-w-28 truncate text-xs font-bold xl:block">{user?.full_name || user?.email}</span>
            </button>
          </Dropdown>
        </div>
      </Header>

      <AnnouncementStrip
        surface={ANNOUNCEMENT_SURFACES.EMPLOYER_WORKSPACE}
        path={pathname}
        verificationPath={employerAppPath('/xac-thuc-email')}
        employerProfile={profile}
        employerProfileReady={profileQuery.isSuccess}
        employerReadiness={readiness}
        employerReadinessReady={!isChecking && !isAccessError}
        legacy={showComplianceNotice ? (
          <div className="z-20 flex min-h-8 shrink-0 items-center justify-center bg-[#df4037] px-4 py-1 text-center text-[10px] font-bold leading-4 text-white sm:text-xs">
            <span className="hidden sm:inline">{m.employer_workspace_compliance_important()} {candidateBlocker?.message || m.employer_workspace_compliance_default()} </span>
            <Link to={complianceAction.to} className="text-white underline decoration-white/60 underline-offset-2 hover:text-white">{complianceAction.label}</Link>
          </div>
        ) : null}
      />

      <Layout className="!relative !min-h-0 !min-w-0 !flex-1 !overflow-hidden !bg-[#edf1f5]">
        {isMobileViewport && !sidebarCollapsed && (
          <button
            type="button"
            aria-label={m.employer_workspace_close_menu()}
            onClick={() => setCollapsed(true)}
            className="absolute inset-y-0 right-0 z-30 cursor-default bg-slate-950/45 backdrop-blur-[1px]"
            style={{ left: EMPLOYER_SIDEBAR_WIDTH }}
          />
        )}
        <Sider
          width={EMPLOYER_SIDEBAR_WIDTH}
          breakpoint="lg"
          collapsedWidth={isMobileViewport ? 0 : EMPLOYER_SIDEBAR_COLLAPSED_WIDTH}
          collapsed={sidebarCollapsed}
          onBreakpoint={handleSidebarBreakpoint}
          onMouseEnter={() => {
            if (collapsed && !isMobileViewport) setIsSidebarHovered(true)
          }}
          onMouseLeave={() => setIsSidebarHovered(false)}
          trigger={null}
          data-testid="employer-sidebar"
          className={`employer-sider !h-full !overflow-hidden ${isMobileViewport ? '!absolute !inset-y-0 !left-0 !z-40 !shadow-2xl' : ''}`}
        >
          <div className="flex h-full flex-col">
            <div className={`employer-sider__profile ${isCompactSidebar ? 'employer-sider__profile--compact' : ''}`}>
              {isCompactSidebar ? (
                <Tooltip title={m.employer_workspace_title_account_info()} placement="right">
                  <Link to={EMPLOYER_ACCOUNT_SETTINGS_URL} aria-label={m.employer_workspace_title_account_info()}>
                    <Avatar size={34} src={user?.avatar_url || undefined} className="employer-sider__avatar">{initials}</Avatar>
                  </Link>
                </Tooltip>
              ) : (
                <>
                  <Link to={EMPLOYER_ACCOUNT_SETTINGS_URL} aria-label={m.employer_workspace_title_account_info()} className="employer-sider__identity">
                    <Avatar size={36} src={user?.avatar_url || undefined} className="employer-sider__avatar">{initials}</Avatar>
                    <span className="employer-sider__text">
                      <span className="employer-sider__name">{user?.full_name || m.employer_workspace_employer_fallback_name()}</span>
                      {user?.public_id && <span className="employer-sider__code">{m.employer_workspace_employer_code({ code: user.public_id })}</span>}
                    </span>
                  </Link>
                  <span className="employer-sider__verification">
                    {m.employer_workspace_verification_level_label()} <strong>{m.employer_workspace_verification_level({ level: accountVerificationLevel.level, total: accountVerificationLevel.total })}</strong>
                    <Popover
                      trigger={['hover', 'focus']}
                      placement="rightTop"
                      styles={{ container: { padding: 12 } }}
                      content={<EmployerAccountVerificationPopover verification={effectiveVerification} level={accountVerificationLevel} />}
                    >
                      <button type="button" aria-label={m.employer_workspace_verification_details_button()} className="employer-sider__help"><QuestionCircleFilled /></button>
                    </Popover>
                  </span>
                </>
              )}
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto">
              <Menu
                mode="inline"
                inlineCollapsed={isCompactSidebar}
                selectedKeys={[selectedMenuKey]}
                openKeys={menuOpenKey ? [menuOpenKey] : []}
                onOpenChange={(keys) => setMenuOpenKey(keys.find((key) => key !== menuOpenKey) || '')}
                items={employerNavItems({ unreadApplications })}
                onClick={navigateFromMenu}
                className="employer-nav"
              />
            </div>
          </div>
        </Sider>

        <Layout className="!min-h-0 !min-w-0 !overflow-hidden !bg-[#edf1f5]">
          <div className="flex min-h-11 shrink-0 items-center justify-between gap-3 border-b border-slate-200 bg-white px-3 py-2 sm:min-h-12 sm:px-6">
            <div className="flex min-w-0 items-center gap-1.5 sm:gap-2">
              {(isJobForm || isCampaignDetail || (isApplicationWorkspace && (applicationJobId || applicationCampaignId))) && (
                <Button
                  size="small"
                  icon={<ArrowLeftOutlined />}
                  aria-label={isApplicationWorkspace ? applicationBackLabel : m.employer_workspace_back()}
                  title={isApplicationWorkspace ? applicationBackLabel : undefined}
                  onClick={isCampaignDetail
                    ? () => navigate(employerAppPath('/campaigns'))
                    : isApplicationWorkspace
                      ? goBackFromApplications
                      : goBackFromForm}
                  className="!inline-flex !items-center !gap-1.5 !rounded-lg !border !border-slate-300 !bg-white !px-3 !py-1 !text-xs !font-semibold !text-slate-700 shadow-2xs transition hover:!border-slate-400 hover:!bg-slate-50 hover:!text-slate-900"
                >
                  {m.employer_workspace_back()}
                </Button>
              )}
              {isCampaignDetail ? (
                <strong className="min-w-0 truncate text-sm font-bold text-slate-800 sm:text-base">
                  {m.employer_workspace_campaign_detail_heading()}
                </strong>
              ) : (
                <strong className="min-w-0 truncate text-sm text-slate-700">{employerRouteTitle(pathname)}</strong>
              )}
            </div>
            {routeAction && (
              <Link to={employerAppPath(routeAction.to)}>
                <Button
                  type="primary"
                  icon={<PlusOutlined aria-hidden />}
                  className="!h-9 !rounded-lg !px-3.5 !font-semibold !shadow-none"
                >
                  {routeAction.label}
                </Button>
              </Link>
            )}
          </div>
          <Content
            data-testid="employer-workspace-content"
            className="workspace-content min-h-0 min-w-0 overflow-x-hidden overflow-y-auto"
            style={{
              // 56px topbar + 48px route bar. A percentage here would resolve
              // against each descendant's containing block, not this scrollport.
              '--workspace-viewport': 'calc(100dvh - 104px - var(--announcement-strip-height, 0px))',
            }}
          >
            <div className="workspace-page">
              <Outlet />
            </div>
          </Content>
        </Layout>
      </Layout>
    </Layout>
  )
}
