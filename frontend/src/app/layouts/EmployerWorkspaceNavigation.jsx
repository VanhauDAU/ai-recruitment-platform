import {
  BarChartOutlined,
  BulbOutlined,
  DashboardOutlined,
  FileTextOutlined,
  GiftOutlined,
  HistoryOutlined,
  LikeOutlined,
  NotificationOutlined,
  RobotOutlined,
  SettingOutlined,
  ShoppingCartOutlined,
  TagsOutlined,
  TeamOutlined,
  ThunderboltOutlined,
  ToolOutlined,
} from '@ant-design/icons'
import { createElement } from 'react'
import { employerAppPath } from '@/shared/config/portals'

function comingSoonLabel(label) {
  return createElement(
    'span',
    { className: 'flex min-w-0 items-center justify-between gap-2' },
    createElement('span', { className: 'truncate' }, label),
    createElement(
      'span',
      {
        className:
          'rounded bg-slate-100 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wide text-slate-400',
      },
      'Sắp mở',
    ),
  )
}

export const EMPLOYER_NAV_ITEMS = [
  {
    key: employerAppPath('/dashboard'),
    icon: <DashboardOutlined />,
    label: 'Bảng tin',
    title: 'Bảng tin',
  },
  {
    key: 'coming-insights',
    icon: <BulbOutlined />,
    label: comingSoonLabel('ProCV Insights'),
    title: 'ProCV Insights — Sắp mở',
    disabled: true,
  },
  {
    key: 'coming-rewards',
    icon: <GiftOutlined />,
    label: comingSoonLabel('ProCV Rewards'),
    title: 'ProCV Rewards — Sắp mở',
    disabled: true,
  },
  {
    key: 'coming-ai',
    icon: <RobotOutlined />,
    label: comingSoonLabel('AI đề xuất'),
    title: 'AI đề xuất — Sắp mở',
    disabled: true,
  },
  {
    key: 'coming-cv-recommendations',
    icon: <LikeOutlined />,
    label: comingSoonLabel('CV đề xuất'),
    title: 'CV đề xuất — Sắp mở',
    disabled: true,
  },
  { type: 'divider' },
  {
    key: employerAppPath('/campaigns'),
    icon: <ThunderboltOutlined />,
    label: 'Chiến dịch tuyển dụng',
    title: 'Chiến dịch tuyển dụng',
  },
  {
    key: employerAppPath('/jobs'),
    icon: <FileTextOutlined />,
    label: 'Tin tuyển dụng',
    title: 'Tin tuyển dụng',
  },
  {
    key: 'cv-management',
    icon: <TeamOutlined />,
    label: 'Quản lý CV',
    title: 'Quản lý CV',
    children: [
      {
        key: 'coming-cv-labels',
        label: comingSoonLabel('Quản lý nhãn CV'),
        title: 'Quản lý nhãn CV — Sắp mở',
        disabled: true,
      },
      {
        key: 'coming-cv-connection-requests',
        label: comingSoonLabel('Quản lý yêu cầu kết nối CV'),
        title: 'Quản lý yêu cầu kết nối CV — Sắp mở',
        disabled: true,
      },
    ],
  },
  {
    key: 'coming-reports',
    icon: <BarChartOutlined />,
    label: comingSoonLabel('Báo cáo tuyển dụng'),
    title: 'Báo cáo tuyển dụng — Sắp mở',
    disabled: true,
  },
  { type: 'divider' },
  {
    key: 'coming-buy-services',
    icon: <ShoppingCartOutlined />,
    label: comingSoonLabel('Mua dịch vụ'),
    title: 'Mua dịch vụ — Sắp mở',
    disabled: true,
  },
  {
    key: 'coming-services',
    icon: <ToolOutlined />,
    label: comingSoonLabel('Dịch vụ của tôi'),
    title: 'Dịch vụ của tôi — Sắp mở',
    disabled: true,
  },
  {
    key: 'coming-coupons',
    icon: <TagsOutlined />,
    label: comingSoonLabel('Mã ưu đãi'),
    title: 'Mã ưu đãi — Sắp mở',
    disabled: true,
  },
  { type: 'divider' },
  {
    key: 'coming-activity',
    icon: <HistoryOutlined />,
    label: comingSoonLabel('Lịch sử hoạt động'),
    title: 'Lịch sử hoạt động — Sắp mở',
    disabled: true,
  },
  {
    key: employerAppPath('/account/settings/account-info'),
    icon: <SettingOutlined />,
    label: 'Cài đặt tài khoản',
    title: 'Cài đặt tài khoản',
  },
  { type: 'divider' },
  {
    key: 'coming-system-notifications',
    icon: <NotificationOutlined />,
    label: comingSoonLabel('Thông báo hệ thống'),
    title: 'Thông báo hệ thống — Sắp mở',
    disabled: true,
  },
]

const ROUTE_TITLES = [
  [employerAppPath('/dashboard'), 'Bảng tin'],
  [employerAppPath('/campaigns'), 'Chiến dịch tuyển dụng'],
  [employerAppPath('/jobs'), 'Tin tuyển dụng'],
  [employerAppPath('/applications'), 'Hồ sơ ứng tuyển'],
  [employerAppPath('/employer-verify'), 'Xác thực tài khoản'],
  [employerAppPath('/account/phone-verify'), 'Xác thực số điện thoại'],
  [employerAppPath('/account/settings/account-info'), 'Thông tin tài khoản'],
  [employerAppPath('/account/settings/password-login'), 'Thay đổi mật khẩu'],
  [employerAppPath('/account/settings/company'), 'Cài đặt tài khoản'],
  [employerAppPath('/account/settings/gpkd'), 'Giấy đăng ký doanh nghiệp'],
  [employerAppPath('/account/settings/personal-data-protection'), 'Văn bản xử lý dữ liệu cá nhân'],
  [employerAppPath('/account/settings/recruitment-demand'), 'Nhu cầu tuyển dụng'],
  [employerAppPath('/account/settings/general-setting'), 'Cài đặt'],
]

export function employerRouteTitle(pathname) {
  return (
    ROUTE_TITLES.find(([path]) => pathname === path)?.[1] || 'Không gian nhà tuyển dụng'
  )
}

export function employerSelectedMenuKey(pathname) {
  if (
    pathname.startsWith(employerAppPath('/account/settings')) ||
    pathname === employerAppPath('/account/phone-verify')
  ) {
    return employerAppPath('/account/settings/account-info')
  }
  if (pathname === employerAppPath('/applications')) return 'cv-management'
  return pathname
}
