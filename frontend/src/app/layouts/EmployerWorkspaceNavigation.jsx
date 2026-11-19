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
import { m } from '@/shared/config/i18n'
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
      m.employer_workspace_nav_coming_soon(),
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
        'aria-label': m.employer_workspace_nav_unread_cv_count({ count }),
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
      'aria-label': m.employer_workspace_nav_has_unread_cv(),
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
      label: m.employer_workspace_title_dashboard(),
      title: m.employer_workspace_title_dashboard(),
    },
    {
      key: 'coming-insights',
      icon: <BulbOutlined />,
      label: comingSoonLabel('ProCV Insights'),
      title: m.employer_workspace_nav_coming_soon_title({ label: 'ProCV Insights' }),
      disabled: true,
    },
    {
      key: 'coming-rewards',
      icon: <GiftOutlined />,
      label: comingSoonLabel('ProCV Rewards'),
      title: m.employer_workspace_nav_coming_soon_title({ label: 'ProCV Rewards' }),
      disabled: true,
    },
    {
      key: 'coming-ai',
      icon: <RobotOutlined />,
      label: comingSoonLabel(m.employer_workspace_nav_ai_recommendations()),
      title: m.employer_workspace_nav_coming_soon_title({ label: m.employer_workspace_nav_ai_recommendations() }),
      disabled: true,
    },
    {
      key: 'coming-cv-recommendations',
      icon: <LikeOutlined />,
      label: comingSoonLabel(m.employer_workspace_nav_cv_recommendations()),
      title: m.employer_workspace_nav_coming_soon_title({ label: m.employer_workspace_nav_cv_recommendations() }),
      disabled: true,
    },
    { type: 'divider' },
    {
      key: employerAppPath('/campaigns'),
      icon: <ThunderboltOutlined />,
      label: m.employer_workspace_title_campaigns(),
      title: m.employer_workspace_title_campaigns(),
    },
    {
      key: employerAppPath('/jobs'),
      icon: <FileTextOutlined />,
      label: m.employer_workspace_title_jobs(),
      title: m.employer_workspace_title_jobs(),
    },
    {
      key: employerAppPath('/company-page'),
      icon: <LayoutOutlined />,
      label: m.employer_workspace_title_company_page(),
      title: m.employer_workspace_title_company_page(),
    },
    {
      key: CV_MANAGEMENT_MENU_KEY,
      icon: <TeamOutlined />,
      label: unreadDotLabel(m.employer_workspace_nav_cv_management(), unreadApplications > 0),
      title: m.employer_workspace_nav_cv_management(),
      children: [
        {
          key: employerAppPath('/applications'),
          label: countLabel(m.employer_workspace_title_applications(), unreadApplications),
          title: m.employer_workspace_title_applications(),
        },
        {
          key: employerAppPath('/talent-pool'),
          label: m.employer_workspace_title_talent_pool(),
          title: m.employer_workspace_title_talent_pool(),
        },
        {
          key: employerAppPath('/candidate-blocks'),
          label: m.employer_workspace_title_candidate_blocks(),
          title: m.employer_workspace_title_candidate_blocks(),
        },
        {
          key: 'coming-cv-labels',
          label: comingSoonLabel(m.employer_workspace_nav_cv_labels()),
          title: m.employer_workspace_nav_coming_soon_title({ label: m.employer_workspace_nav_cv_labels() }),
          disabled: true,
        },
        {
          key: 'coming-cv-connection-requests',
          label: comingSoonLabel(m.employer_workspace_nav_cv_connection_requests()),
          title: m.employer_workspace_nav_coming_soon_title({ label: m.employer_workspace_nav_cv_connection_requests() }),
          disabled: true,
        },
      ],
    },
    {
      key: 'coming-reports',
      icon: <BarChartOutlined />,
      label: comingSoonLabel(m.employer_workspace_nav_reports()),
      title: m.employer_workspace_nav_coming_soon_title({ label: m.employer_workspace_nav_reports() }),
      disabled: true,
    },
    { type: 'divider' },
    {
      key: employerAppPath('/activities'),
      icon: <HistoryOutlined />,
      label: m.employer_workspace_title_activities(),
      title: m.employer_workspace_title_activities(),
    },
    {
      key: employerAppPath('/account/settings/account-info'),
      icon: <SettingOutlined />,
      label: m.employer_workspace_nav_account_settings(),
      title: m.employer_workspace_nav_account_settings(),
    },
    { type: 'divider' },
    {
      key: employerAppPath('/notifications'),
      icon: <NotificationOutlined />,
      label: m.employer_workspace_title_notifications(),
      title: m.employer_workspace_title_notifications(),
    },
  ]
}

// Thanh trên cùng dùng chung nguồn với tiêu đề tab để hai nơi không lệch nhau.
export function employerRouteTitle(pathname) {
  const title = resolveEmployerRouteTitle(pathname)
  return title && title !== NOT_FOUND_TITLE ? title : m.employer_workspace_nav_fallback_title()
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
