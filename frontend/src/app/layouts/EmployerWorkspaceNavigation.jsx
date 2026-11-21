import {
  DashboardOutlined,
  FileTextOutlined,
  RocketOutlined,
  TeamOutlined,
  UserOutlined,
} from '@ant-design/icons'
import { createElement } from 'react'
import { NOT_FOUND_TITLE } from '@/shared/config/document-title'
import { m } from '@/shared/config/i18n'
import { employerAppPath } from '@/shared/config/portals'
import { resolveEmployerRouteTitle } from '../router/document-title'

function countLabel(label, count) {
  if (!count) return label
  return createElement(
    'span',
    { className: 'employer-nav__row' },
    createElement('span', { className: 'employer-nav__label' }, label),
    createElement(
      'span',
      {
        className: 'employer-nav__count',
        'aria-label': m.employer_workspace_nav_unread_cv_count({ count }),
      },
      count > 99 ? '99+' : count,
    ),
  )
}

// The closed group only hints that something is waiting; the count sits on
// the inbox item itself.
function unreadDotLabel(label, hasUnread) {
  if (!hasUnread) return label
  return createElement(
    'span',
    null,
    label,
    createElement('span', {
      className: 'employer-nav__dot',
      'aria-label': m.employer_workspace_nav_has_unread_cv(),
    }),
  )
}

// Only top-level rows carry an icon; children hang off the group's guide line.
const link = (path, title, label = title) => ({ key: employerAppPath(path), label, title })

// Features on the roadmap share one closed group at the bottom, so they stay
// visible without crowding the pages that work today.
const upcoming = (key, label) => ({
  key: `coming-${key}`,
  label,
  title: m.employer_workspace_nav_coming_soon_title({ label }),
  disabled: true,
})

export const CV_MANAGEMENT_MENU_KEY = 'cv-management'

/** Sidebar items; `unreadApplications` badges the CV inbox (submitted, not yet opened). */
export function employerNavItems({ unreadApplications = 0 } = {}) {
  return [
    { ...link('/dashboard', m.employer_workspace_title_dashboard()), icon: <DashboardOutlined /> },
    {
      key: 'recruiting',
      icon: <FileTextOutlined />,
      label: m.employer_workspace_nav_recruiting(),
      children: [
        link('/campaigns', m.employer_workspace_title_campaigns()),
        link('/jobs', m.employer_workspace_title_jobs()),
        link('/company-page', m.employer_workspace_title_company_page()),
      ],
    },
    {
      key: CV_MANAGEMENT_MENU_KEY,
      icon: <TeamOutlined />,
      label: unreadDotLabel(m.employer_workspace_nav_cv_management(), unreadApplications > 0),
      title: m.employer_workspace_nav_cv_management(),
      children: [
        link(
          '/applications',
          m.employer_workspace_title_applications(),
          countLabel(m.employer_workspace_title_applications(), unreadApplications),
        ),
        link('/talent-pool', m.employer_workspace_title_talent_pool()),
        link('/candidate-blocks', m.employer_workspace_title_candidate_blocks()),
      ],
    },
    {
      key: 'account',
      icon: <UserOutlined />,
      label: m.employer_workspace_nav_account(),
      children: [
        link('/notifications', m.employer_workspace_title_notifications()),
        link('/activities', m.employer_workspace_title_activities()),
        link('/account/settings/account-info', m.employer_workspace_nav_account_settings()),
      ],
    },
    {
      key: 'upcoming',
      icon: <RocketOutlined />,
      label: m.employer_workspace_nav_upcoming(),
      children: [
        upcoming('insights', 'ProCV Insights'),
        upcoming('rewards', 'ProCV Rewards'),
        upcoming('ai', m.employer_workspace_nav_ai_recommendations()),
        upcoming('cv-recommendations', m.employer_workspace_nav_cv_recommendations()),
        upcoming('cv-labels', m.employer_workspace_nav_cv_labels()),
        upcoming('cv-connection-requests', m.employer_workspace_nav_cv_connection_requests()),
        upcoming('reports', m.employer_workspace_nav_reports()),
        upcoming('support', m.employer_workspace_support_inbox()),
      ],
    },
  ]
}

/** The group holding `selectedKey`, opened by default so the current page is in view. */
export function employerOpenMenuKey(selectedKey) {
  return employerNavItems()
    .find((item) => item.children?.some((child) => child.key === selectedKey))?.key
}

// Thanh trên cùng dùng chung nguồn với tiêu đề tab để hai nơi không lệch nhau.
export function employerRouteTitle(pathname) {
  const title = resolveEmployerRouteTitle(pathname)
  return title && title !== NOT_FOUND_TITLE ? title : m.employer_workspace_nav_fallback_title()
}

const SECTION_PATHS = [
  '/dashboard', '/campaigns', '/jobs', '/company-page', '/applications',
  '/talent-pool', '/candidate-blocks', '/notifications', '/activities',
].map((path) => employerAppPath(path))

/** Detail and form pages keep their section lit (a job's editor lights "Tin tuyển dụng"). */
export function employerSelectedMenuKey(pathname) {
  if (
    pathname.startsWith(employerAppPath('/account/settings')) ||
    pathname === employerAppPath('/account/phone-verify')
  ) {
    return employerAppPath('/account/settings/account-info')
  }
  return SECTION_PATHS.find((path) => pathname === path || pathname.startsWith(`${path}/`)) || pathname
}
