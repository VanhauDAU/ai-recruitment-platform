import {
  AppstoreOutlined,
  BankOutlined,
  DownOutlined,
  FileSearchOutlined,
  InboxOutlined,
  ReadOutlined,
  SearchOutlined,
  SettingOutlined,
  TeamOutlined,
} from '@ant-design/icons'
import { Tooltip } from 'antd'
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router'
import { getIntlLocale, m } from '@/shared/config/i18n'
import { findActiveAdminNavigation } from '../router/admin/admin-navigation'
import {
  readSidebarPreference,
  saveSidebarPreference,
  SIDEBAR_OPEN_GROUPS_KEY,
} from './admin-sidebar-storage'

const ICONS = {
  accounts: <TeamOutlined />,
  companies: <BankOutlined />,
  content: <ReadOutlined />,
  dashboard: <AppstoreOutlined />,
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
  // Accordion: one group open at a time keeps the sidebar short.
  const [openGroup, setOpenGroup] = useState(() => {
    const saved = readSidebarPreference(SIDEBAR_OPEN_GROUPS_KEY, null)
    return typeof saved === 'string'
      ? saved
      : navigation.find((node) => node.defaultOpen)?.key || ''
  })

  // The current page's group and a group picked from the collapsed rail open
  // themselves; the administrator can still close them afterwards.
  useEffect(() => {
    if (activeGroup) setOpenGroup(activeGroup)
  }, [activeGroup])
  useEffect(() => {
    if (requestedOpenKey) setOpenGroup(requestedOpenKey)
  }, [requestedOpenKey])

  useEffect(() => saveSidebarPreference(SIDEBAR_OPEN_GROUPS_KEY, openGroup), [openGroup])

  const toggleGroup = (key) => setOpenGroup((current) => (current === key ? '' : key))
  const isActive = (node) => (
    node.children ? activeGroup === node.key : activeLeaf?.key === node.key
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
        {navigation.map((node) => {
          const className = `admin-nav__collapsed-button ${
            isActive(node) ? 'admin-nav__collapsed-button--active' : ''
          }`
          const icon = ICONS[node.iconKey] || <AppstoreOutlined />
          return (
            <Tooltip key={node.key} placement="right" title={node.label}>
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
      {navigation.map((node) => {
        const active = isActive(node)
        const icon = (
          <span className="admin-nav__level-one-icon" aria-hidden="true">
            {ICONS[node.iconKey] || <AppstoreOutlined />}
          </span>
        )
        const levelOneClass = `admin-nav__level-one ${active ? 'admin-nav__level-one--active' : ''}`
        const open = openGroup === node.key
        const groupId = `admin-nav-group-${node.key}`
        if (!node.children) {
          return (
            <Link
              key={node.key}
              to={node.href}
              className={levelOneClass}
              aria-current={active ? 'page' : undefined}
              onClick={onNavigate}
            >
              {icon}
              <span className="admin-nav__label">{node.label}</span>
              {nodeCount(node)}
            </Link>
          )
        }
        return (
          <div key={node.key} className="admin-nav__group">
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
              <DownOutlined className={`admin-nav__chevron ${open ? 'admin-nav__chevron--open' : ''}`} />
            </button>
            {/* Kept mounted so closing animates too; inert hides it from focus and AT. */}
            <div
              id={groupId}
              className={`admin-nav__collapse ${open ? 'admin-nav__collapse--open' : ''}`}
              inert={!open}
              aria-hidden={!open}
            >
              <div className="admin-nav__secondary">
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
                      <span className="admin-nav__label">{leaf.label}</span>
                      {nodeCount(leaf)}
                    </Link>
                  )
                })}
              </div>
            </div>
          </div>
        )
      })}
    </nav>
  )
}
