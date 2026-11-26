import {
  DashboardOutlined,
  FileTextOutlined,
  HistoryOutlined,
  LayoutOutlined,
  NotificationOutlined,
  SettingOutlined,
  TeamOutlined,
  ThunderboltOutlined,
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

const link = (path, title, label = title) => ({ key: employerAppPath(path), label, title })
const iconLink = (path, Icon, title) => ({ ...link(path, title), icon: <Icon /> })

export const CV_MANAGEMENT_MENU_KEY = 'cv-management'

/**
 * Sidebar items: only pages that work today, in the original order. The CV
 * tools fold into one dropdown; `unreadApplications` badges the CV inbox
 * (submitted, not yet opened).
 */
export function employerNavItems({ unreadApplications = 0 } = {}) {
  return [
    iconLink('/tong-quan', DashboardOutlined, m.employer_workspace_title_dashboard()),
    { type: 'divider', key: 'divider-work' },
    iconLink('/chien-dich', ThunderboltOutlined, m.employer_workspace_title_campaigns()),
    iconLink('/tin-tuyen-dung', FileTextOutlined, m.employer_workspace_title_jobs()),
    iconLink('/trang-cong-ty', LayoutOutlined, m.employer_workspace_title_company_page()),
    {
      key: CV_MANAGEMENT_MENU_KEY,
      icon: <TeamOutlined />,
      label: unreadDotLabel(m.employer_workspace_nav_cv_management(), unreadApplications > 0),
      title: m.employer_workspace_nav_cv_management(),
      children: [
        link(
          '/ho-so-ung-tuyen',
          m.employer_workspace_title_applications(),
          countLabel(m.employer_workspace_title_applications(), unreadApplications),
        ),
        link('/tim-ung-vien', m.employer_workspace_title_candidate_search()),
        link('/kho-ung-vien', m.employer_workspace_title_talent_pool()),
        link('/ung-vien-bi-chan', m.employer_workspace_title_candidate_blocks()),
      ],
    },
    { type: 'divider', key: 'divider-account' },
    iconLink('/lich-su-hoat-dong', HistoryOutlined, m.employer_workspace_title_activities()),
    iconLink('/cai-dat/thong-tin-tai-khoan', SettingOutlined, m.employer_workspace_nav_account_settings()),
    iconLink('/thong-bao', NotificationOutlined, m.employer_workspace_title_notifications()),
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
  '/tong-quan', '/chien-dich', '/tin-tuyen-dung', '/trang-cong-ty', '/ho-so-ung-tuyen',
  '/kho-ung-vien', '/tim-ung-vien', '/ung-vien-bi-chan', '/thong-bao', '/lich-su-hoat-dong',
].map((path) => employerAppPath(path))

/** Detail and form pages keep their section lit (a job's editor lights "Tin tuyển dụng"). */
export function employerSelectedMenuKey(pathname) {
  if (
    pathname.startsWith(employerAppPath('/cai-dat')) ||
    pathname === employerAppPath('/xac-thuc-so-dien-thoai')
  ) {
    return employerAppPath('/cai-dat/thong-tin-tai-khoan')
  }
  return SECTION_PATHS.find((path) => pathname === path || pathname.startsWith(`${path}/`)) || pathname
}
