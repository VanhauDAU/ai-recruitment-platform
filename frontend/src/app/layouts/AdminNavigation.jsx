import {
  AppstoreOutlined,
  BankOutlined,
  ContactsOutlined,
  FileDoneOutlined,
  FileTextOutlined,
  IdcardOutlined,
  KeyOutlined,
  LeftOutlined,
  RightOutlined,
  SafetyCertificateOutlined,
  SearchOutlined,
  SettingOutlined,
  SolutionOutlined,
  TeamOutlined,
  NotificationOutlined,
} from '@ant-design/icons'
import { Input, Tag, Tooltip } from 'antd'
import { useEffect, useMemo, useState } from 'react'
import {
  findActiveAdminNavigation,
  searchAdminNavigation,
} from '../router/admin/admin-navigation'

const ICONS = {
  access: <KeyOutlined />,
  account: <IdcardOutlined />,
  accounts: <TeamOutlined />,
  announcements: <NotificationOutlined />,
  blog: <FileTextOutlined />,
  companies: <BankOutlined />,
  cv: <FileTextOutlined />,
  dashboard: <AppstoreOutlined />,
  leads: <ContactsOutlined />,
  moderation: <FileDoneOutlined />,
  services: <SolutionOutlined />,
  settings: <SettingOutlined />,
  shield: <SafetyCertificateOutlined />,
}

function ComingSoon() {
  return <Tag className="admin-nav__coming-soon">Sắp ra mắt</Tag>
}

function NavigationCount({ count }) {
  const value = Number(count || 0)
  if (value <= 0) return null
  const label = value > 99 ? '99+' : String(value)
  return (
    <span
      className="admin-nav__count"
      aria-label={`${value.toLocaleString('vi-VN')} mục đang chờ`}
    >
      {label}
    </span>
  )
}

function hasChildren(item) {
  return Boolean(item.children?.length)
}

function isLevelOneActive(activeLeaf, levelOne) {
  return hasChildren(levelOne)
    ? activeLeaf?.ancestors[0] === levelOne.key
    : activeLeaf?.key === levelOne.key
}

function LeafButton({ leaf, active, onSelect, showBreadcrumb = false }) {
  const disabled = leaf.status === 'comingSoon' || !leaf.href
  return (
    <button
      type="button"
      className={`admin-nav__leaf ${active ? 'admin-nav__leaf--active' : ''}`}
      disabled={disabled}
      aria-current={active ? 'page' : undefined}
      onClick={() => !disabled && onSelect(leaf)}
    >
      <span className="admin-nav__leaf-marker" aria-hidden="true" />
      <span className="min-w-0 flex-1">
        <span className="admin-nav__leaf-label">{leaf.label}</span>
        {showBreadcrumb && (
          <span className="admin-nav__breadcrumb">
            {leaf.breadcrumb.slice(0, -1).join(' / ')}
          </span>
        )}
      </span>
      <NavigationCount count={leaf.badgeCount} />
      {leaf.status === 'comingSoon' && <ComingSoon />}
    </button>
  )
}

function SearchResults({ navigation, query, activeLeaf, onSelect }) {
  const results = useMemo(
    () => searchAdminNavigation(navigation, query),
    [navigation, query],
  )
  return (
    <div className="admin-nav__search-results">
      <p className="admin-nav__section-label">
        {results.length ? `${results.length} kết quả` : 'Không tìm thấy mục phù hợp'}
      </p>
      {results.map((leaf) => (
        <LeafButton
          key={leaf.key}
          leaf={leaf}
          active={activeLeaf?.key === leaf.key}
          showBreadcrumb
          onSelect={onSelect}
        />
      ))}
    </div>
  )
}

function MobileNavigation({
  navigation,
  activeLeaf,
  pathname,
  onSelect,
}) {
  const [trail, setTrail] = useState([])
  const currentLevelOne = navigation.find((item) => item.key === trail[0])
  const currentLevelTwo = currentLevelOne?.children?.find((item) => item.key === trail[1])

  useEffect(() => {
    setTrail([])
  }, [pathname])

  if (currentLevelTwo) {
    return (
      <div className="admin-nav__mobile-level">
        <button
          type="button"
          className="admin-nav__back"
          onClick={() => setTrail([currentLevelOne.key])}
        >
          <LeftOutlined /> {currentLevelOne.label}
        </button>
        <div className="admin-nav__mobile-heading">
          <strong>{currentLevelTwo.label}</strong>
        </div>
        {currentLevelTwo.children.map((leaf) => (
          <LeafButton
            key={leaf.key}
            leaf={leaf}
            active={activeLeaf?.key === leaf.key}
            onSelect={onSelect}
          />
        ))}
      </div>
    )
  }

  if (currentLevelOne) {
    return (
      <div className="admin-nav__mobile-level">
        <button type="button" className="admin-nav__back" onClick={() => setTrail([])}>
          <LeftOutlined /> Menu chính
        </button>
        <div className="admin-nav__mobile-heading">
          <strong>{currentLevelOne.label}</strong>
        </div>
        {currentLevelOne.children.map((levelTwo) => (
          <button
            type="button"
            key={levelTwo.key}
            className={`admin-nav__level-two ${
              activeLeaf?.key === levelTwo.key ? 'admin-nav__level-two--active' : ''
            }`}
            disabled={levelTwo.status === 'comingSoon' || (!hasChildren(levelTwo) && !levelTwo.href)}
            aria-current={activeLeaf?.key === levelTwo.key ? 'page' : undefined}
            onClick={() => {
              if (hasChildren(levelTwo)) {
                setTrail([currentLevelOne.key, levelTwo.key])
              } else {
                onSelect(levelTwo)
              }
            }}
          >
            <strong>{levelTwo.label}</strong>
            <NavigationCount count={levelTwo.badgeCount} />
            {levelTwo.status === 'comingSoon' && <ComingSoon />}
            {hasChildren(levelTwo) && <RightOutlined />}
          </button>
        ))}
      </div>
    )
  }

  return (
    <div className="admin-nav__mobile-level">
      <p className="admin-nav__section-label">Không gian quản trị</p>
      {navigation.map((levelOne) => {
        const grouped = hasChildren(levelOne)
        const active = isLevelOneActive(activeLeaf, levelOne)
        const disabled = levelOne.status === 'comingSoon' || (!grouped && !levelOne.href)
        return (
          <button
            type="button"
            key={levelOne.key}
            aria-label={levelOne.label}
            className={`admin-nav__level-one ${
              active ? 'admin-nav__level-one--active' : ''
            }`}
            disabled={disabled}
            aria-current={active && !grouped ? 'page' : undefined}
            onClick={() => {
              if (disabled) return
              if (grouped) {
                setTrail([levelOne.key])
              } else {
                onSelect(levelOne)
              }
            }}
          >
            <span className="admin-nav__level-one-icon">{ICONS[levelOne.iconKey]}</span>
            <span className="flex-1 text-left">{levelOne.label}</span>
            <NavigationCount count={levelOne.badgeCount} />
            {grouped && <RightOutlined />}
          </button>
        )
      })}
    </div>
  )
}

export default function AdminNavigation({
  navigation,
  pathname,
  search = '',
  navigate,
  collapsed = false,
  mobile = false,
  onNavigate,
  onRequestExpand,
  requestedOpenKey = '',
}) {
  const activeLeaf = useMemo(
    () => findActiveAdminNavigation(navigation, pathname, search),
    [navigation, pathname, search],
  )
  const [openLevelOne, setOpenLevelOne] = useState(() => (
    activeLeaf
      ? activeLeaf.ancestors[0] || ''
      : navigation.find(hasChildren)?.key || ''
  ))
  const [openLevelTwo, setOpenLevelTwo] = useState('')
  const [flyoutTop, setFlyoutTop] = useState(82)
  const [query, setQuery] = useState('')

  useEffect(() => {
    if (activeLeaf) {
      setOpenLevelOne(activeLeaf.ancestors[0] || '')
    }
  }, [activeLeaf])

  useEffect(() => {
    if (requestedOpenKey) setOpenLevelOne(requestedOpenKey)
  }, [requestedOpenKey])

  useEffect(() => {
    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        setOpenLevelTwo('')
        setQuery('')
      }
    }
    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [])

  const selectLeaf = (leaf) => {
    setOpenLevelTwo('')
    navigate(leaf.href)
    onNavigate?.()
  }

  if (collapsed && !mobile) {
    return (
      <nav className="admin-sider__navigation admin-nav admin-nav--collapsed" aria-label="Điều hướng quản trị">
        {navigation.map((levelOne) => {
          const grouped = hasChildren(levelOne)
          const active = isLevelOneActive(activeLeaf, levelOne)
          return (
            <Tooltip key={levelOne.key} placement="right" title={levelOne.label}>
              <button
                type="button"
                className={`admin-nav__collapsed-button ${
                  active ? 'admin-nav__collapsed-button--active' : ''
                }`}
                aria-label={levelOne.label}
                aria-current={active && !grouped ? 'page' : undefined}
                onClick={() => (
                  grouped ? onRequestExpand?.(levelOne.key) : selectLeaf(levelOne)
                )}
              >
                {ICONS[levelOne.iconKey] || <AppstoreOutlined />}
                <NavigationCount count={levelOne.badgeCount} />
              </button>
            </Tooltip>
          )
        })}
      </nav>
    )
  }

  if (mobile) {
    return (
      <nav className="admin-sider__navigation admin-nav admin-nav--mobile" aria-label="Điều hướng quản trị">
        <MobileNavigation
          navigation={navigation}
          activeLeaf={activeLeaf}
          pathname={pathname}
          onSelect={selectLeaf}
        />
      </nav>
    )
  }

  const currentLevelOne = navigation.find((item) => item.key === openLevelOne)
  const currentLevelTwo = currentLevelOne?.children?.find((item) => item.key === openLevelTwo)

  return (
    <nav className="admin-sider__navigation admin-nav" aria-label="Điều hướng quản trị">
      <div className="admin-nav__search">
        <Input
          allowClear
          aria-label="Tìm chức năng quản trị"
          placeholder="Tìm chức năng..."
          prefix={<SearchOutlined />}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </div>

      {query.trim() ? (
        <SearchResults
          navigation={navigation}
          query={query}
          activeLeaf={activeLeaf}
          onSelect={selectLeaf}
        />
      ) : (
        <>
          <div className="admin-nav__primary">
            {navigation.map((levelOne) => {
              const grouped = hasChildren(levelOne)
              const isOpen = grouped && openLevelOne === levelOne.key
              const isActive = isLevelOneActive(activeLeaf, levelOne)
              const disabled = (
                levelOne.status === 'comingSoon'
                || (!grouped && !levelOne.href)
              )
              return (
                <div key={levelOne.key} className="admin-nav__group">
                  <button
                    type="button"
                    aria-label={levelOne.label}
                    className={`admin-nav__level-one ${isActive ? 'admin-nav__level-one--active' : ''}`}
                    disabled={disabled}
                    aria-current={isActive && !grouped ? 'page' : undefined}
                    aria-expanded={grouped ? isOpen : undefined}
                    onClick={() => {
                      if (disabled) return
                      if (!grouped) {
                        selectLeaf(levelOne)
                        return
                      }
                      setOpenLevelOne(isOpen ? '' : levelOne.key)
                      setOpenLevelTwo('')
                    }}
                  >
                    <span className="admin-nav__level-one-icon">
                      {ICONS[levelOne.iconKey] || <AppstoreOutlined />}
                    </span>
                    <span className="flex-1 text-left">{levelOne.label}</span>
                    {!isOpen && <NavigationCount count={levelOne.badgeCount} />}
                    {grouped && (
                      <RightOutlined className={isOpen ? 'admin-nav__chevron--open' : ''} />
                    )}
                  </button>
                  {grouped && isOpen && (
                    <div className="admin-nav__secondary">
                      {levelOne.children.map((levelTwo) => {
                        const grouped = hasChildren(levelTwo)
                        const isLevelTwoActive = grouped
                          ? activeLeaf?.ancestors[1] === levelTwo.key
                          : activeLeaf?.key === levelTwo.key
                        const disabled = (
                          levelTwo.status === 'comingSoon'
                          || (!grouped && !levelTwo.href)
                        )
                        return (
                          <button
                            type="button"
                            key={levelTwo.key}
                            className={`admin-nav__level-two ${!grouped ? 'admin-nav__level-two--direct' : ''} ${
                              isLevelTwoActive ? 'admin-nav__level-two--active' : ''
                            }`}
                            disabled={disabled}
                            aria-current={isLevelTwoActive && !grouped ? 'page' : undefined}
                            aria-expanded={grouped ? openLevelTwo === levelTwo.key : undefined}
                            onClick={(event) => {
                              if (disabled) return
                              if (!grouped) {
                                selectLeaf(levelTwo)
                                return
                              }
                              setFlyoutTop(Math.max(82, event.currentTarget.getBoundingClientRect().top))
                              setOpenLevelTwo(
                                openLevelTwo === levelTwo.key ? '' : levelTwo.key,
                              )
                            }}
                          >
                            <strong>{levelTwo.label}</strong>
                            {(!grouped || openLevelTwo !== levelTwo.key) && (
                              <NavigationCount count={levelTwo.badgeCount} />
                            )}
                            {levelTwo.status === 'comingSoon' && <ComingSoon />}
                            {grouped && <RightOutlined />}
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {currentLevelTwo && (
            <aside
              className="admin-nav__flyout"
              aria-label={currentLevelTwo.label}
              style={{ '--admin-nav-flyout-top': `${flyoutTop}px` }}
            >
              <div className="admin-nav__flyout-items">
                {currentLevelTwo.children.map((leaf) => (
                  <LeafButton
                    key={leaf.key}
                    leaf={leaf}
                    active={activeLeaf?.key === leaf.key}
                    onSelect={selectLeaf}
                  />
                ))}
              </div>
            </aside>
          )}
        </>
      )}
    </nav>
  )
}
