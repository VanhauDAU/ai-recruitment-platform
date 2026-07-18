import {
  ArrowRightOutlined,
  BarChartOutlined,
  BellOutlined,
  BulbOutlined,
  CheckCircleFilled,
  CustomerServiceOutlined,
  DashboardOutlined,
  FileTextOutlined,
  GiftOutlined,
  HistoryOutlined,
  LikeOutlined,
  LogoutOutlined,
  MenuOutlined,
  MessageOutlined,
  NotificationOutlined,
  QuestionCircleFilled,
  RobotOutlined,
  SafetyCertificateOutlined,
  SearchOutlined,
  SettingOutlined,
  ShoppingCartOutlined,
  SwapOutlined,
  TagsOutlined,
  TeamOutlined,
  ThunderboltOutlined,
  ToolOutlined,
} from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import { Avatar, Button, Dropdown, Layout, Menu, Popover, Tooltip } from 'antd'
import { useState } from 'react'
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { getEmployerProfile } from '@/entities/employer-profile'
import { useSession } from '@/entities/session'
import { BrandLogo } from '@/entities/site-settings'
import { getEmployerAccountVerificationLevel } from '@/features/verify-employer-account'
import {
  EMPLOYER_ACCOUNT_SETTINGS_URL,
  EMPLOYER_COMPANY_SETTINGS_URL,
  EMPLOYER_DATA_PROTECTION_URL,
  EMPLOYER_PHONE_VERIFY_URL,
  EMPLOYER_VERIFY_URL,
  MAIN_PORTAL_URL,
  employerAppPath,
} from '@/shared/config/portals'

const { Header, Sider, Content } = Layout

// Mirrors the employer workspace navigation in TopCV: an expanded work menu
// and a compact, icon-only rail that keeps the current workspace usable.
const EMPLOYER_SIDEBAR_WIDTH = 240
const EMPLOYER_SIDEBAR_COLLAPSED_WIDTH = 64

const ACCOUNT_VERIFICATION_LEVEL_STEPS = [
  { key: 'phone_verified', label: 'Xác thực số điện thoại', to: EMPLOYER_PHONE_VERIFY_URL },
  { key: 'company_linked', label: 'Cập nhật thông tin công ty', to: `${EMPLOYER_COMPANY_SETTINGS_URL}?update=true` },
  { key: 'business_doc_submitted', label: 'Xác thực Giấy đăng ký doanh nghiệp', to: employerAppPath('/account/settings/gpkd') },
]

function ComingSoonLabel({ children }) {
  return (
    <span className="flex min-w-0 items-center justify-between gap-2">
      <span className="truncate">{children}</span>
      <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wide text-slate-400">Sắp mở</span>
    </span>
  )
}

const EMPLOYER_NAV_ITEMS = [
  { key: employerAppPath('/dashboard'), icon: <DashboardOutlined />, label: 'Bảng tin', title: 'Bảng tin' },
  { key: 'coming-insights', icon: <BulbOutlined />, label: <ComingSoonLabel>ProCV Insights</ComingSoonLabel>, title: 'ProCV Insights — Sắp mở', disabled: true },
  { key: 'coming-rewards', icon: <GiftOutlined />, label: <ComingSoonLabel>ProCV Rewards</ComingSoonLabel>, title: 'ProCV Rewards — Sắp mở', disabled: true },
  { key: 'coming-ai', icon: <RobotOutlined />, label: <ComingSoonLabel>AI đề xuất</ComingSoonLabel>, title: 'AI đề xuất — Sắp mở', disabled: true },
  { key: 'coming-cv-recommendations', icon: <LikeOutlined />, label: <ComingSoonLabel>CV đề xuất</ComingSoonLabel>, title: 'CV đề xuất — Sắp mở', disabled: true },
  { type: 'divider' },
  { key: 'coming-campaigns', icon: <ThunderboltOutlined />, label: <ComingSoonLabel>Chiến dịch tuyển dụng</ComingSoonLabel>, title: 'Chiến dịch tuyển dụng — Sắp mở', disabled: true },
  { key: 'coming-jobs', icon: <FileTextOutlined />, label: <ComingSoonLabel>Tin tuyển dụng</ComingSoonLabel>, title: 'Tin tuyển dụng — Sắp mở', disabled: true },
  { key: 'coming-applications', icon: <TeamOutlined />, label: <ComingSoonLabel>Quản lý CV</ComingSoonLabel>, title: 'Quản lý CV — Sắp mở', disabled: true },
  { key: 'coming-reports', icon: <BarChartOutlined />, label: <ComingSoonLabel>Báo cáo tuyển dụng</ComingSoonLabel>, title: 'Báo cáo tuyển dụng — Sắp mở', disabled: true },
  { type: 'divider' },
  { key: 'coming-buy-services', icon: <ShoppingCartOutlined />, label: <ComingSoonLabel>Mua dịch vụ</ComingSoonLabel>, title: 'Mua dịch vụ — Sắp mở', disabled: true },
  { key: 'coming-services', icon: <ToolOutlined />, label: <ComingSoonLabel>Dịch vụ của tôi</ComingSoonLabel>, title: 'Dịch vụ của tôi — Sắp mở', disabled: true },
  { key: 'coming-coupons', icon: <TagsOutlined />, label: <ComingSoonLabel>Mã ưu đãi</ComingSoonLabel>, title: 'Mã ưu đãi — Sắp mở', disabled: true },
  { type: 'divider' },
  { key: 'coming-activity', icon: <HistoryOutlined />, label: <ComingSoonLabel>Lịch sử hoạt động</ComingSoonLabel>, title: 'Lịch sử hoạt động — Sắp mở', disabled: true },
  { key: EMPLOYER_ACCOUNT_SETTINGS_URL, icon: <SettingOutlined />, label: 'Cài đặt tài khoản', title: 'Cài đặt tài khoản' },
  { type: 'divider' },
  { key: 'coming-system-notifications', icon: <NotificationOutlined />, label: <ComingSoonLabel>Thông báo hệ thống</ComingSoonLabel>, title: 'Thông báo hệ thống — Sắp mở', disabled: true },
]

const ROUTE_TITLES = [
  [employerAppPath('/dashboard'), 'Bảng tin'],
  [EMPLOYER_VERIFY_URL, 'Xác thực tài khoản'],
  [EMPLOYER_PHONE_VERIFY_URL, 'Xác thực số điện thoại'],
  [EMPLOYER_ACCOUNT_SETTINGS_URL, 'Thông tin tài khoản'],
  [employerAppPath('/account/settings/password-login'), 'Thay đổi mật khẩu'],
  [EMPLOYER_COMPANY_SETTINGS_URL, 'Cài đặt tài khoản'],
  [employerAppPath('/account/settings/gpkd'), 'Giấy đăng ký doanh nghiệp'],
  [EMPLOYER_DATA_PROTECTION_URL, 'Văn bản xử lý dữ liệu cá nhân'],
]

function routeTitle(pathname) {
  return ROUTE_TITLES.find(([path]) => pathname === path)?.[1] || 'Không gian nhà tuyển dụng'
}

function selectedMenuKey(pathname) {
  if (pathname.startsWith(employerAppPath('/account/settings')) || pathname === EMPLOYER_PHONE_VERIFY_URL) {
    return EMPLOYER_ACCOUNT_SETTINGS_URL
  }
  return pathname
}

function TopbarAction({ icon, label, prominent = false }) {
  return (
    <Tooltip title={`${label} — chức năng sẽ được mở trong giai đoạn tiếp theo`}>
      <span
        aria-disabled="true"
        className={`hidden h-8 cursor-not-allowed items-center gap-1.5 rounded-full border px-3 text-xs font-bold lg:inline-flex ${prominent ? 'border-emerald-500/45 bg-emerald-500/15 text-emerald-300' : 'border-white/10 bg-white/10 text-slate-200'}`}
      >
        {icon}{label}
      </span>
    </Tooltip>
  )
}

function AccountVerificationPopover({ verification, level }) {
  return (
    <div className="w-[330px] p-1 sm:w-[344px]" aria-label="Chi tiết cấp xác thực tài khoản">
      <div className="flex items-center gap-2 text-base font-bold text-slate-800">
        <span>Tài khoản xác thực:</span>
        <strong className="text-emerald-600">Cấp {level.level}/{level.total}</strong>
      </div>
      <span className="mt-4 flex h-10 w-10 items-center justify-center rounded-full bg-emerald-50 text-xl">🌟</span>
      <p className="mt-4 text-sm text-slate-500">Vui lòng thực hiện các bước xác thực dưới đây:</p>
      <div className="mt-5 flex items-center justify-between text-sm">
        <strong className="text-base text-slate-800">Xác thực thông tin</strong>
        <span className="text-slate-500">Hoàn thành <strong className="text-emerald-600">{level.percent}%</strong></span>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
        <span className="block h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${level.percent}%` }} />
      </div>
      <div className="mt-3 divide-y divide-slate-100">
        {ACCOUNT_VERIFICATION_LEVEL_STEPS.map((step) => {
          const completed = Boolean(verification[step.key])
          return (
            <Link
              key={step.key}
              to={step.to}
              className="flex items-center gap-3 py-4 text-sm font-semibold text-slate-700 transition hover:text-emerald-700"
            >
              <span className={`flex h-5 w-5 items-center justify-center rounded-full ${completed ? 'text-emerald-600' : 'border border-slate-400 text-transparent'}`}>
                {completed && <CheckCircleFilled />}
              </span>
              <span className="min-w-0 flex-1">{step.label}</span>
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-50 text-emerald-600"><ArrowRightOutlined /></span>
            </Link>
          )
        })}
      </div>
      <div className="mt-4 flex justify-end border-t border-slate-100 pt-4">
        <Link to={EMPLOYER_VERIFY_URL} className="rounded-md border border-emerald-500 px-4 py-2 text-sm font-medium text-emerald-600 transition hover:bg-emerald-50">Tìm hiểu thêm</Link>
      </div>
    </div>
  )
}

export default function EmployerWorkspaceLayout() {
  const { user, logout } = useSession()
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const [collapsed, setCollapsed] = useState(false)
  const [isSidebarHovered, setIsSidebarHovered] = useState(false)
  const [isMobileViewport, setIsMobileViewport] = useState(false)
  const profileQuery = useQuery({
    queryKey: ['employer', 'profile'],
    queryFn: getEmployerProfile,
    staleTime: 30 * 1000,
  })
  const profile = profileQuery.data || {}
  const verification = profile.onboarding || {}
  const accountVerificationLevel = getEmployerAccountVerificationLevel(verification)
  const showComplianceNotice = profileQuery.isSuccess
    && (!verification.candidate_dpa_submitted || !verification.dpa_accepted)
  const initials = (user?.full_name || user?.email || 'NTD').trim().charAt(0).toUpperCase()
  const sidebarCollapsed = collapsed && (isMobileViewport || !isSidebarHovered)
  const isCompactSidebar = sidebarCollapsed && !isMobileViewport
  const canSwitchToCandidate = user?.available_roles?.includes('candidate')
  const accountMenu = {
    items: [
      { key: 'settings', label: 'Cài đặt tài khoản', icon: <SettingOutlined /> },
      // Tài khoản đa vai: đã có năng lực ứng viên -> chuyển sang cổng ứng viên
      // (điều hướng toàn trang vì token lưu tách theo cổng).
      ...(canSwitchToCandidate
        ? [{ key: 'candidate-portal', label: 'Về trang ứng viên', icon: <SwapOutlined /> }]
        : []),
      { type: 'divider' },
      { key: 'logout', label: 'Đăng xuất', icon: <LogoutOutlined />, danger: true },
    ],
    onClick: ({ key }) => {
      if (key === 'settings') navigate(EMPLOYER_ACCOUNT_SETTINGS_URL)
      if (key === 'candidate-portal') window.location.assign(MAIN_PORTAL_URL)
      if (key === 'logout') logout()
    },
  }

  function navigateFromMenu({ key }) {
    if (!key.startsWith('coming-')) navigate(key)
    if (isMobileViewport) setCollapsed(true)
  }

  function handleSidebarBreakpoint(isBroken) {
    setIsMobileViewport(isBroken)
    setIsSidebarHovered(false)
    setCollapsed(isBroken)
  }

  return (
    <Layout data-testid="employer-workspace" className="!flex !h-dvh !min-h-dvh !flex-col !overflow-hidden !bg-[#edf1f5]">
      {showComplianceNotice && (
        <div className="z-20 flex min-h-8 shrink-0 items-center justify-center bg-[#df4037] px-4 py-1 text-center text-[10px] font-bold leading-4 text-white sm:text-xs">
          <span className="hidden sm:inline">[QUAN TRỌNG] Hoàn thiện Thỏa thuận xử lý dữ liệu cá nhân để bảo vệ hồ sơ ứng viên. </span>
          <Link to={EMPLOYER_DATA_PROTECTION_URL} className="text-white underline decoration-white/60 underline-offset-2 hover:text-white">Cập nhật ngay</Link>
        </div>
      )}

      <Header data-testid="employer-topbar" className="!z-20 !flex !h-14 !shrink-0 !items-center !justify-between !bg-[#1e2f40] !px-3 !leading-none sm:!px-4">
        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
          <Button
            type="text"
            aria-label={collapsed ? 'Mở menu quản trị' : 'Thu gọn menu quản trị'}
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
          <TopbarAction icon={<BarChartOutlined />} label="Khảo sát thị trường" prominent />
          <TopbarAction icon={<FileTextOutlined />} label="Đăng tin" />
          <TopbarAction icon={<SearchOutlined />} label="Tìm CV" />
          <TopbarAction icon={<MessageOutlined />} label="Connect" />
          <Tooltip title="Thông báo hệ thống">
            <Button type="text" shape="circle" aria-label="Thông báo hệ thống" icon={<BellOutlined />} className="!text-slate-200 hover:!bg-white/10 hover:!text-white" />
          </Tooltip>
          <Dropdown menu={accountMenu} trigger={['click']} placement="bottomRight">
            <button type="button" className="flex cursor-pointer items-center gap-2 rounded-full border-0 bg-white/10 p-1 pr-2 text-white transition hover:bg-white/15" aria-label="Mở menu tài khoản">
              <Avatar size={28} src={user?.avatar_url || undefined} className="!bg-slate-100 !font-bold !text-slate-700">{initials}</Avatar>
              <span className="hidden max-w-28 truncate text-xs font-bold xl:block">{user?.full_name || user?.email}</span>
            </button>
          </Dropdown>
        </div>
      </Header>

      <Layout className="!min-h-0 !min-w-0 !flex-1 !overflow-hidden !bg-[#edf1f5]">
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
          className="!h-full !overflow-hidden !border-r !border-slate-200 !bg-white"
        >
          <div className="flex h-full flex-col bg-white">
            <div className={`shrink-0 border-b border-slate-100 ${isCompactSidebar ? 'px-2 py-3' : 'px-4 py-4'}`}>
              {isCompactSidebar ? (
                <div className="flex flex-col items-center gap-3">
                  <Tooltip title="Thông tin tài khoản" placement="right">
                    <Link to={EMPLOYER_ACCOUNT_SETTINGS_URL} aria-label="Thông tin tài khoản">
                      <Avatar size={34} src={user?.avatar_url || undefined} className="!bg-slate-100 !font-bold !text-slate-500">{initials}</Avatar>
                    </Link>
                  </Tooltip>
                  <Tooltip title={accountVerificationLevel.percent === 100 ? 'Tài khoản đã đủ an toàn' : 'Tài khoản cần hoàn thiện'} placement="right">
                    <Link
                      to={EMPLOYER_VERIFY_URL}
                      aria-label="Xem trạng thái xác thực tài khoản"
                      className={`flex h-8 w-8 items-center justify-center rounded-full text-sm transition ${accountVerificationLevel.percent === 100 ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100' : 'bg-red-50 text-red-600 hover:bg-red-100'}`}
                    >
                      <SafetyCertificateOutlined />
                    </Link>
                  </Tooltip>
                </div>
              ) : (
                <>
                  <div className="flex items-start gap-3">
                    <Link to={EMPLOYER_ACCOUNT_SETTINGS_URL} aria-label="Thông tin tài khoản" className="flex min-w-0 flex-1 items-start gap-3 rounded-xl outline-none transition hover:bg-emerald-50 focus-visible:ring-2 focus-visible:ring-emerald-500">
                      <Avatar size={42} src={user?.avatar_url || undefined} className="!bg-slate-100 !font-bold !text-slate-500">{initials}</Avatar>
                    <div className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-extrabold text-slate-800 transition hover:text-emerald-600">{user?.full_name || 'Nhà tuyển dụng'}</span>
                      <span className="mt-0.5 block text-[11px] font-semibold text-slate-500">Employer</span>
                      <span className="mt-1 block truncate text-[10px] text-slate-400">Mã NTD: {profile.public_id || user?.public_id || '—'}</span>
                    </div>
                    </Link>
                  </div>
                  <span className="mt-1 flex items-center gap-1 text-[10px] text-slate-500">
                    Tài khoản xác thực: <strong className="text-emerald-600">Cấp {accountVerificationLevel.level}/{accountVerificationLevel.total}</strong>
                    <Popover
                      trigger={['hover', 'focus']}
                      placement="rightTop"
                      overlayInnerStyle={{ padding: 12 }}
                      content={<AccountVerificationPopover verification={verification} level={accountVerificationLevel} />}
                    >
                      <button type="button" aria-label="Xem chi tiết cấp xác thực tài khoản" className="inline-flex cursor-help text-slate-400 transition hover:text-slate-600"><QuestionCircleFilled /></button>
                    </Popover>
                  </span>
                  <Link
                    to={EMPLOYER_VERIFY_URL}
                    className={`mt-3 flex items-center justify-center gap-2 rounded-full px-3 py-2 text-[11px] font-bold transition ${accountVerificationLevel.percent === 100 ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100' : 'bg-red-50 text-red-600 hover:bg-red-100'}`}
                  >
                    <SafetyCertificateOutlined /> {accountVerificationLevel.percent === 100 ? 'Tài khoản đã đủ an toàn' : 'Tài khoản cần hoàn thiện'}
                  </Link>
                </>
              )}
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto py-2">
              <Menu
                mode="inline"
                inlineCollapsed={isCompactSidebar}
                selectedKeys={[selectedMenuKey(pathname)]}
                items={EMPLOYER_NAV_ITEMS}
                onClick={navigateFromMenu}
                className="!border-0 !bg-white [&_.ant-menu-item]:!mx-2 [&_.ant-menu-item]:!my-0.5 [&_.ant-menu-item]:!h-10 [&_.ant-menu-item]:!w-auto [&_.ant-menu-item]:!rounded-lg [&_.ant-menu-item]:!px-3 [&_.ant-menu-item]:!text-xs [&_.ant-menu-item-divider]:!my-2 [&_.ant-menu-item-selected]:!bg-emerald-50 [&_.ant-menu-item-selected]:!font-bold [&_.ant-menu-item-selected]:!text-emerald-600 [&.ant-menu-inline-collapsed_.ant-menu-item]:!flex [&.ant-menu-inline-collapsed_.ant-menu-item]:!w-12 [&.ant-menu-inline-collapsed_.ant-menu-item]:!items-center [&.ant-menu-inline-collapsed_.ant-menu-item]:!justify-center [&.ant-menu-inline-collapsed_.ant-menu-item]:!px-0 [&.ant-menu-inline-collapsed_.ant-menu-item_.anticon]:!mr-0 [&.ant-menu-inline-collapsed_.ant-menu-item_.anticon]:!text-xl"
              />
            </div>

            <div className="shrink-0 border-t border-slate-100 p-2">
              <Tooltip title={isCompactSidebar ? 'Hộp thư hỗ trợ — Sắp mở' : null} placement="right">
                <div aria-disabled="true" className={`flex cursor-not-allowed items-center rounded-lg py-2.5 text-xs font-semibold text-slate-500 ${isCompactSidebar ? 'justify-center px-0' : 'gap-3 px-3'}`}><CustomerServiceOutlined className={`${isCompactSidebar ? 'text-xl' : 'text-base'} text-emerald-600`} /> {!isCompactSidebar && <>Hộp thư hỗ trợ <span className="ml-auto text-[9px] text-slate-400">Sắp mở</span></>}</div>
              </Tooltip>
            </div>
          </div>
        </Sider>

        <Layout className="!min-h-0 !min-w-0 !overflow-hidden !bg-[#edf1f5]">
          <div className="flex h-12 shrink-0 items-center border-b border-slate-200 bg-white px-4 sm:px-6">
            <strong className="text-sm text-slate-700">{routeTitle(pathname)}</strong>
          </div>
          <Content className="min-h-0 min-w-0 overflow-y-auto bg-[#edf1f5] p-3 sm:p-5 xl:p-6">
            <div className="mx-auto w-full max-w-[1320px]">
              <Outlet />
            </div>
          </Content>
        </Layout>
      </Layout>
    </Layout>
  )
}
