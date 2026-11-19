import {
  BarChartOutlined,
  BulbOutlined,
  DashboardOutlined,
  FileTextOutlined,
  GiftOutlined,
  HistoryOutlined,
  LayoutOutlined,
  LikeOutlined,
  NotificationOutlined,
  RobotOutlined,
  SettingOutlined,
  TeamOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons'
import { createElement } from 'react'
import { NOT_FOUND_TITLE } from '@/shared/config/document-title'
import { employerAppPath } from '@/shared/config/portals'
import { resolveEmployerRouteTitle } from '../router/document-title'

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

function countLabel(label, count) {
  if (!count) return label
  return createElement(
    'span',
    { className: 'flex min-w-0 items-center justify-between gap-2' },
    createElement('span', { className: 'truncate' }, label),
    createElement(
      'span',
      {
        className: 'rounded-full bg-emerald-50 px-1.5 py-0.5 text-[10px] font-bold text-emerald-600',
        'aria-label': `${count} CV mới chưa xem`,
      },
      count > 99 ? '99+' : count,
    ),
  )
}

// The collapsed group only hints that something is waiting; the count sits on
// the inbox item itself.
function unreadDotLabel(label, hasUnread) {
  if (!hasUnread) return label
  return createElement(
    'span',
    null,
    label,
    createElement('span', {
      className: 'ml-1.5 inline-block h-2 w-2 rounded-full bg-emerald-500 align-middle',
      'aria-label': 'Có CV mới chưa xem',
    }),
  )
}

export const CV_MANAGEMENT_MENU_KEY = 'cv-management'

/** Sidebar items; `unreadApplications` badges the CV inbox (submitted, not yet opened). */
export function employerNavItems({ unreadApplications = 0 } = {}) {
  return [
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
      key: employerAppPath('/company-page'),
      icon: <LayoutOutlined />,
      label: 'Trang công ty',
      title: 'Trang công ty',
    },
    {
      key: CV_MANAGEMENT_MENU_KEY,
      icon: <TeamOutlined />,
      label: unreadDotLabel('Quản lý CV', unreadApplications > 0),
      title: 'Quản lý CV',
      children: [
        {
          key: employerAppPath('/applications'),
          label: countLabel('CV ứng tuyển', unreadApplications),
          title: 'CV ứng tuyển',
        },
        {
          key: employerAppPath('/talent-pool'),
          label: 'Kho ứng viên tiềm năng',
          title: 'Kho ứng viên tiềm năng',
        },
        {
          key: employerAppPath('/candidate-blocks'),
          label: 'Danh sách đen',
          title: 'Danh sách đen',
        },
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
      key: employerAppPath('/activities'),
      icon: <HistoryOutlined />,
      label: 'Lịch sử hoạt động',
      title: 'Lịch sử hoạt động',
    },
    {
      key: employerAppPath('/account/settings/account-info'),
      icon: <SettingOutlined />,
      label: 'Cài đặt tài khoản',
      title: 'Cài đặt tài khoản',
    },
    { type: 'divider' },
    {
      key: employerAppPath('/notifications'),
      icon: <NotificationOutlined />,
      label: 'Thông báo hệ thống',
      title: 'Thông báo hệ thống',
    },
  ]
}

// Thanh trên cùng dùng chung nguồn với tiêu đề tab để hai nơi không lệch nhau.
export function employerRouteTitle(pathname) {
  const title = resolveEmployerRouteTitle(pathname)
  return title && title !== NOT_FOUND_TITLE ? title : 'Không gian nhà tuyển dụng'
}

export function employerSelectedMenuKey(pathname) {
  if (
    pathname.startsWith(employerAppPath('/account/settings')) ||
    pathname === employerAppPath('/account/phone-verify')
  ) {
    return employerAppPath('/account/settings/account-info')
  }
  return pathname
}
