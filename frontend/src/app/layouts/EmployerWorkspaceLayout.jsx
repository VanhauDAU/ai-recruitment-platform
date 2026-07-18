import {
  BarChartOutlined,
  BellOutlined,
  CrownOutlined,
  DashboardOutlined,
  FileTextOutlined,
  LogoutOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  SafetyCertificateOutlined,
  TeamOutlined,
} from '@ant-design/icons'
import { Avatar, Button, Dropdown, Layout, Menu, Tooltip } from 'antd'
import { useState } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useSession } from '@/entities/session'
import { BrandLogo } from '@/entities/site-settings'
import { employerAppPath } from '@/shared/config/portals'

const { Header, Sider, Content } = Layout

function ComingSoonLabel({ children }) {
  return <span className="flex items-center justify-between gap-2"><span>{children}</span><span className="rounded bg-white/10 px-1.5 py-0.5 text-[9px] uppercase tracking-wide text-slate-400">Sắp mở</span></span>
}

const EMPLOYER_NAV_ITEMS = [
  {
    type: 'group',
    label: 'Workspace',
    children: [
      { key: employerAppPath('/dashboard'), icon: <DashboardOutlined />, label: 'Bảng tin' },
      { key: 'coming-jobs', icon: <FileTextOutlined />, label: <ComingSoonLabel>Tin tuyển dụng</ComingSoonLabel>, disabled: true },
      { key: 'coming-applications', icon: <TeamOutlined />, label: <ComingSoonLabel>Quản lý ứng viên</ComingSoonLabel>, disabled: true },
      { key: 'coming-reports', icon: <BarChartOutlined />, label: <ComingSoonLabel>Báo cáo tuyển dụng</ComingSoonLabel>, disabled: true },
    ],
  },
  {
    type: 'group',
    label: 'Tài khoản & dịch vụ',
    children: [
      { key: employerAppPath('/employer-verify'), icon: <SafetyCertificateOutlined />, label: 'Xác thực tài khoản' },
      { key: 'coming-services', icon: <CrownOutlined />, label: <ComingSoonLabel>Dịch vụ tuyển dụng</ComingSoonLabel>, disabled: true },
    ],
  },
]

export default function EmployerWorkspaceLayout() {
  const { user, logout } = useSession()
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const [collapsed, setCollapsed] = useState(false)
  const initials = (user?.full_name || user?.email || 'NTD').trim().charAt(0).toUpperCase()
  const accountMenu = {
    items: [{ key: 'logout', label: 'Đăng xuất', icon: <LogoutOutlined />, danger: true }],
    onClick: ({ key }) => key === 'logout' && logout(),
  }

  function navigateFromMenu({ key }) {
    if (!key.startsWith('coming-')) navigate(key)
    if (window.innerWidth < 992) setCollapsed(true)
  }

  return (
    <Layout data-testid="employer-workspace" className="!h-dvh !min-h-dvh !overflow-hidden !bg-[#f2f5f9]">
      <Sider
        width={264}
        breakpoint="lg"
        collapsedWidth="0"
        collapsed={collapsed}
        onBreakpoint={setCollapsed}
        trigger={null}
        className="!h-dvh !overflow-y-auto !bg-[#16283a] shadow-xl"
      >
        <div className="flex h-18 items-center border-b border-white/8 px-6">
          <BrandLogo
            dark
            to={employerAppPath('/dashboard')}
            className="max-w-full"
            imageClassName="h-8 max-w-[168px]"
            textClassName="text-base"
          />
        </div>
        <div className="px-4 py-5">
          <div className="mb-4 rounded-xl border border-white/8 bg-white/5 p-3">
            <div className="flex items-center gap-3">
              <Avatar className="!bg-emerald-500 !font-bold">{initials}</Avatar>
              <div className="min-w-0"><strong className="block truncate text-sm text-white">{user?.full_name || 'Nhà tuyển dụng'}</strong><span className="block truncate text-xs text-slate-400">{user?.email}</span></div>
            </div>
            <div className="mt-3 flex items-center gap-2 rounded-lg bg-amber-400/10 px-3 py-2 text-xs font-semibold text-amber-200"><CrownOutlined /> Tài khoản nhà tuyển dụng</div>
          </div>
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[pathname]}
          items={EMPLOYER_NAV_ITEMS}
          onClick={navigateFromMenu}
          className="!border-0 !bg-transparent [&_.ant-menu-item-group-title]:!px-6 [&_.ant-menu-item-group-title]:!text-[10px] [&_.ant-menu-item-group-title]:!font-bold [&_.ant-menu-item-group-title]:!uppercase [&_.ant-menu-item-group-title]:!tracking-[.16em] [&_.ant-menu-item-group-title]:!text-slate-500 [&_.ant-menu-item-selected]:!bg-emerald-500/15 [&_.ant-menu-item-selected]:!text-emerald-300"
        />
      </Sider>

      <Layout className="!h-dvh !min-h-0 !min-w-0 !overflow-hidden !bg-[#f2f5f9]">
        <Header className="!flex !h-18 !shrink-0 !items-center !justify-between !border-b !border-slate-200 !bg-white !px-4 sm:!px-6">
          <div className="flex items-center gap-3">
            <Button
              type="text"
              aria-label={collapsed ? 'Mở menu quản trị' : 'Thu gọn menu quản trị'}
              icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
              onClick={() => setCollapsed((current) => !current)}
            />
            <div className="hidden sm:block"><strong className="text-sm text-slate-900">Bảng điều khiển nhà tuyển dụng</strong><span className="ml-2 text-xs text-slate-400">Tổng quan hôm nay</span></div>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <Tooltip title="Thông báo hệ thống"><Button type="text" shape="circle" aria-label="Thông báo hệ thống" icon={<BellOutlined />} /></Tooltip>
            <Tooltip title="Kho dịch vụ nội bộ sẽ được triển khai ở giai đoạn tiếp theo"><Button disabled className="!hidden sm:!inline-flex">Dịch vụ tuyển dụng</Button></Tooltip>
            <Dropdown menu={accountMenu} trigger={['click']} placement="bottomRight">
              <button type="button" className="flex cursor-pointer items-center gap-2 rounded-full border-0 bg-transparent p-1.5 transition hover:bg-slate-100" aria-label="Mở menu tài khoản">
                <Avatar size="small" className="!bg-slate-800 !font-bold">{initials}</Avatar>
                <span className="hidden max-w-32 truncate text-sm font-semibold text-slate-700 md:block">{user?.full_name || user?.email}</span>
              </button>
            </Dropdown>
          </div>
        </Header>
        <Content className="min-h-0 min-w-0 overflow-y-auto p-4 sm:p-6 xl:p-7">
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  )
}
