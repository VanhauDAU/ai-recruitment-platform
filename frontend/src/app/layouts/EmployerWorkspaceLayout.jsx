import {
  BarChartOutlined,
  BellOutlined,
  CustomerServiceOutlined,
  DoubleRightOutlined,
  FileTextOutlined,
  LogoutOutlined,
  MenuOutlined,
  MessageOutlined,
  QuestionCircleFilled,
  SafetyCertificateOutlined,
  SearchOutlined,
  SettingOutlined,
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
  EMPLOYER_DATA_PROTECTION_URL,
  EMPLOYER_GENERAL_SETTINGS_URL,
  EMPLOYER_VERIFY_URL,
  employerAppPath,
} from '@/shared/config/portals'
import EmployerAccountVerificationPopover from './EmployerAccountVerificationPopover'
import {
  EMPLOYER_NAV_ITEMS,
  employerRouteTitle,
  employerSelectedMenuKey,
} from './EmployerWorkspaceNavigation'

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
  // "An toàn" ở đây gắn với bảo mật đăng nhập: bật một trong các phương thức xác
  // thực 2 yếu tố (hiện có email) là đủ để ẩn cảnh báo đỏ ở sidebar.
  const accountSecure = Boolean(user?.two_factor_enabled)
  const showComplianceNotice = profileQuery.isSuccess
    && (!verification.candidate_dpa_submitted || !verification.dpa_accepted)
  const initials = (user?.full_name || user?.email || 'NTD').trim().charAt(0).toUpperCase()
  const sidebarCollapsed = collapsed && (isMobileViewport || !isSidebarHovered)
  const isCompactSidebar = sidebarCollapsed && !isMobileViewport
  const accountMenu = {
    items: [
      { key: 'settings', label: 'Cài đặt tài khoản', icon: <SettingOutlined /> },
      { type: 'divider' },
      { key: 'logout', label: 'Đăng xuất', icon: <LogoutOutlined />, danger: true },
    ],
    onClick: ({ key }) => {
      if (key === 'settings') navigate(EMPLOYER_ACCOUNT_SETTINGS_URL)
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
          <TopbarAction icon={<FileTextOutlined />} label="Đăng tin" to={employerAppPath('/jobs/new')} />
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

      <Layout className="!relative !min-h-0 !min-w-0 !flex-1 !overflow-hidden !bg-[#edf1f5]">
        {isMobileViewport && !sidebarCollapsed && (
          <button
            type="button"
            aria-label="Đóng menu quản trị"
            onClick={() => setCollapsed(true)}
            className="absolute inset-0 z-30 cursor-default bg-slate-950/45 backdrop-blur-[1px]"
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
          className={`!h-full !overflow-hidden !border-r !border-slate-200 !bg-white ${isMobileViewport ? '!absolute !inset-y-0 !left-0 !z-40 !shadow-2xl' : ''}`}
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
                  <Tooltip title={accountSecure ? 'Tài khoản đã đủ an toàn' : 'Tài khoản chưa đủ an toàn'} placement="right">
                    <Link
                      to={accountSecure ? EMPLOYER_VERIFY_URL : EMPLOYER_GENERAL_SETTINGS_URL}
                      aria-label="Xem trạng thái xác thực tài khoản"
                      className={`flex h-8 w-8 items-center justify-center rounded-full text-sm transition ${accountSecure ? '!bg-emerald-50 !text-emerald-700 hover:!bg-emerald-100' : '!bg-red-500 !text-white hover:!bg-red-600'}`}
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
                      styles={{ container: { padding: 12 } }}
                      content={<EmployerAccountVerificationPopover verification={verification} level={accountVerificationLevel} />}
                    >
                      <button type="button" aria-label="Xem chi tiết cấp xác thực tài khoản" className="inline-flex cursor-help text-slate-400 transition hover:text-slate-600"><QuestionCircleFilled /></button>
                    </Popover>
                  </span>
                  {!accountSecure && (
                    <Link
                      to={EMPLOYER_GENERAL_SETTINGS_URL}
                      className="mt-3 flex items-center justify-center gap-2 whitespace-nowrap rounded-full !bg-red-500 px-3 py-2 text-[11px] font-bold !text-white transition hover:!bg-red-600"
                    >
                      <SafetyCertificateOutlined /> Tài khoản chưa đủ an toàn
                      <DoubleRightOutlined aria-hidden="true" className="animate-nudge-x" />
                    </Link>
                  )}
                </>
              )}
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto py-2">
              <Menu
                mode="inline"
                inlineCollapsed={isCompactSidebar}
                selectedKeys={[employerSelectedMenuKey(pathname)]}
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
          <div className="flex min-h-11 shrink-0 items-center border-b border-slate-200 bg-white px-3 py-2 sm:min-h-12 sm:px-6">
            <strong className="min-w-0 truncate text-sm text-slate-700">{employerRouteTitle(pathname)}</strong>
          </div>
          <Content className="min-h-0 min-w-0 overflow-x-hidden overflow-y-auto bg-[#edf1f5] p-2.5 sm:p-5 xl:p-6">
            <div className="mx-auto w-full max-w-[1320px]">
              <Outlet />
            </div>
          </Content>
        </Layout>
      </Layout>
    </Layout>
  )
}
