import {
  AppstoreOutlined,
  BankOutlined,
  FileSearchOutlined,
  FileTextOutlined,
  InboxOutlined,
  NotificationOutlined,
  QuestionCircleOutlined,
  ReadOutlined,
  RightOutlined,
  SafetyCertificateOutlined,
  SearchOutlined,
  SettingOutlined,
  TeamOutlined,
  UserAddOutlined,
} from '@ant-design/icons'
import { Tooltip } from 'antd'
import { Fragment, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router'
import { getIntlLocale, m } from '@/shared/config/i18n'
import { ADMIN_NAVIGATION_SECTIONS } from '../router/admin/admin-navigation.config'
import { findActiveAdminNavigation } from '../router/admin/admin-navigation'
import {
  readSidebarPreference,
  saveSidebarPreference,
  SIDEBAR_OPEN_GROUPS_KEY,
} from './admin-sidebar-storage'

const ICONS = {
  accounts: <TeamOutlined />,
  admins: <SafetyCertificateOutlined />,
  announcements: <NotificationOutlined />,
  blog: <ReadOutlined />,
  companies: <BankOutlined />,
  cv: <FileTextOutlined />,
  dashboard: <AppstoreOutlined />,
  help: <QuestionCircleOutlined />,
  invitations: <UserAddOutlined />,
  jobs: <FileSearchOutlined />,
  queues: <InboxOutlined />,
  settings: <SettingOutlined />,
}

const SHORTCUT_LABEL = typeof navigator !== 'undefined' && /Mac|iP(hone|ad)/.test(navigator.platform)
  ? '⌘K'
  : 'Ctrl K'

function NavigationCount({ count, urgent = false }) {
  const value = Number(count || 0)
  if (value <= 0) return null
  const amount = value.toLocaleString(getIntlLocale())
  return (
    <span
      className={`admin-nav__count ${urgent ? 'admin-nav__count--urgent' : ''}`}
      aria-label={urgent
        ? m.admin_nav_pending_count_overdue({ count: amount })
        : m.admin_nav_pending_count({ count: amount })}
    >
      {value > 99 ? '99+' : String(value)}
    </span>
  )
}

const nodeCount = (node) => (
  <NavigationCount count={node.badgeCount} urgent={node.badgeOverdue > 0} />
)

export default function AdminNavigation({
  navigation,
  pathname,
  search = '',
  collapsed = false,
  mobile = false,
  onNavigate,
  onOpenSearch,
  onRequestExpand,
  requestedOpenKey = '',
}) {
  const activeLeaf = useMemo(
    () => findActiveAdminNavigation(navigation, pathname, search),
    [navigation, pathname, search],
  )
  const activeGroup = activeLeaf?.ancestors[0] || ''
  const [openGroups, setOpenGroups] = useState(() => {
    const saved = readSidebarPreference(SIDEBAR_OPEN_GROUPS_KEY, null)
    return Array.isArray(saved)
      ? saved
      : navigation.filter((node) => node.defaultOpen).map((node) => node.key)
  })

  // The current page's group and a group picked from the collapsed rail open
  // themselves; the administrator can still close them afterwards.
  useEffect(() => {
    const wanted = [activeGroup, requestedOpenKey].filter(Boolean)
    setOpenGroups((keys) => (
      wanted.every((key) => keys.includes(key)) ? keys : [...new Set([...keys, ...wanted])]
    ))
  }, [activeGroup, requestedOpenKey])

  useEffect(() => saveSidebarPreference(SIDEBAR_OPEN_GROUPS_KEY, openGroups), [openGroups])

  const toggleGroup = (key) => setOpenGroups((keys) => (
    keys.includes(key) ? keys.filter((item) => item !== key) : [...keys, key]
  ))
  const isActive = (node) => (
    node.children ? activeGroup === node.key : activeLeaf?.key === node.key
  )
  const sectionStarts = (index) => (
    navigation[index].section && navigation[index].section !== navigation[index - 1]?.section
  )
  const navLabel = m.admin_nav_label()

  if (collapsed) {
    return (
      <nav className="admin-sider__navigation admin-nav admin-nav--collapsed" aria-label={navLabel}>
        {onOpenSearch && (
          <Tooltip placement="right" title={`${m.admin_nav_search_open()} (${SHORTCUT_LABEL})`}>
            <button
              type="button"
              className="admin-nav__collapsed-button"
              aria-label={m.admin_nav_search_open()}
              onClick={onOpenSearch}
            >
              <SearchOutlined />
            </button>
          </Tooltip>
        )}
        {navigation.map((node, index) => {
          const className = `admin-nav__collapsed-button ${
            isActive(node) ? 'admin-nav__collapsed-button--active' : ''
          }`
          const icon = ICONS[node.iconKey] || <AppstoreOutlined />
          return (
            <Fragment key={node.key}>
              {sectionStarts(index) && <span className="admin-nav__divider" aria-hidden="true" />}
              <Tooltip placement="right" title={node.label}>
                {node.children ? (
                  <button
                    type="button"
                    className={className}
                    aria-label={node.label}
                    onClick={() => onRequestExpand?.(node.key)}
                  >
                    {icon}
                    {nodeCount(node)}
                  </button>
                ) : (
                  <Link
                    to={node.href}
                    className={className}
                    aria-label={node.label}
                    aria-current={isActive(node) ? 'page' : undefined}
                    onClick={onNavigate}
                  >
                    {icon}
                    {nodeCount(node)}
                  </Link>
                )}
              </Tooltip>
            </Fragment>
          )
        })}
      </nav>
    )
  }

  return (
    <nav
      className={`admin-sider__navigation admin-nav ${mobile ? 'admin-nav--mobile' : ''}`}
      aria-label={navLabel}
    >
      {onOpenSearch && (
        <button type="button" className="admin-nav__search" onClick={onOpenSearch}>
          <SearchOutlined />
          <span className="admin-nav__search-label">{m.admin_nav_search_open()}</span>
          {!mobile && <kbd>{SHORTCUT_LABEL}</kbd>}
        </button>
      )}
      {navigation.map((node, index) => {
        const active = isActive(node)
        const icon = (
          <span className="admin-nav__level-one-icon" aria-hidden="true">
            {ICONS[node.iconKey] || <AppstoreOutlined />}
          </span>
        )
        const levelOneClass = `admin-nav__level-one ${active ? 'admin-nav__level-one--active' : ''}`
        const open = openGroups.includes(node.key)
        const groupId = `admin-nav-group-${node.key}`
        return (
          <Fragment key={node.key}>
            {sectionStarts(index) && (
              <p className="admin-nav__section-label">{ADMIN_NAVIGATION_SECTIONS[node.section]}</p>
            )}
            {!node.children ? (
              <Link
                to={node.href}
                className={levelOneClass}
                aria-current={active ? 'page' : undefined}
                onClick={onNavigate}
              >
                {icon}
                <span className="admin-nav__label">{node.label}</span>
                {nodeCount(node)}
              </Link>
            ) : (
              <div className="admin-nav__group">
                <button
                  type="button"
                  aria-label={node.label}
                  aria-expanded={open}
                  aria-controls={groupId}
                  className={levelOneClass}
                  onClick={() => toggleGroup(node.key)}
                >
                  {icon}
                  <span className="admin-nav__label">{node.label}</span>
                  {!open && nodeCount(node)}
                  <RightOutlined className={`admin-nav__chevron ${open ? 'admin-nav__chevron--open' : ''}`} />
                </button>
                {open && (
                  <div id={groupId} className="admin-nav__secondary">
                    {node.children.map((leaf) => {
                      const leafActive = activeLeaf?.key === leaf.key
                      const idle = leaf.badgeKey && !leaf.badgeCount
                      return (
                        <Link
                          key={leaf.key}
                          to={leaf.href}
                          className={`admin-nav__leaf ${leafActive ? 'admin-nav__leaf--active' : ''} ${
                            idle ? 'admin-nav__leaf--idle' : ''
                          }`}
                          aria-current={leafActive ? 'page' : undefined}
                          onClick={onNavigate}
                        >
                          <span className="admin-nav__leaf-marker" aria-hidden="true" />
                          <span className="admin-nav__label">{leaf.label}</span>
                          {nodeCount(leaf)}
                        </Link>
                      )
                    })}
                  </div>
                )}
              </div>
            )}
          </Fragment>
        )
      })}
    </nav>
  )
}
