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
  const currentLevelTwo = currentLevelOne?.children.find((item) => item.key === trail[1])

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
            className="admin-nav__level-two"
            onClick={() => setTrail([currentLevelOne.key, levelTwo.key])}
          >
            <strong>{levelTwo.label}</strong>
            <RightOutlined />
          </button>
        ))}
      </div>
    )
  }

  return (
    <div className="admin-nav__mobile-level">
      <p className="admin-nav__section-label">Không gian quản trị</p>
      {navigation.map((levelOne) => (
        <button
          type="button"
          key={levelOne.key}
          className={`admin-nav__level-one ${
            activeLeaf?.ancestors[0] === levelOne.key ? 'admin-nav__level-one--active' : ''
          }`}
          onClick={() => setTrail([levelOne.key])}
        >
          <span className="admin-nav__level-one-icon">{ICONS[levelOne.iconKey]}</span>
          <span className="flex-1 text-left">{levelOne.label}</span>
          <RightOutlined />
        </button>
      ))}
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
}) {
  const activeLeaf = useMemo(
    () => findActiveAdminNavigation(navigation, pathname, search),
    [navigation, pathname, search],
  )
  const [openLevelOne, setOpenLevelOne] = useState(
    activeLeaf?.ancestors[0] || navigation[0]?.key || '',
  )
  const [openLevelTwo, setOpenLevelTwo] = useState('')
  const [query, setQuery] = useState('')

  useEffect(() => {
    if (activeLeaf) {
      setOpenLevelOne(activeLeaf.ancestors[0])
    }
  }, [activeLeaf])

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
        {navigation.map((levelOne) => (
          <Tooltip key={levelOne.key} placement="right" title={levelOne.label}>
            <button
              type="button"
              className={`admin-nav__collapsed-button ${
                activeLeaf?.ancestors[0] === levelOne.key ? 'admin-nav__collapsed-button--active' : ''
              }`}
              aria-label={levelOne.label}
              onClick={() => onRequestExpand?.(levelOne.key)}
            >
              {ICONS[levelOne.iconKey] || <AppstoreOutlined />}
            </button>
          </Tooltip>
        ))}
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
  const currentLevelTwo = currentLevelOne?.children.find((item) => item.key === openLevelTwo)

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
              const isOpen = openLevelOne === levelOne.key
              const isActive = activeLeaf?.ancestors[0] === levelOne.key
              return (
                <div key={levelOne.key} className="admin-nav__group">
                  <button
                    type="button"
                    className={`admin-nav__level-one ${isActive ? 'admin-nav__level-one--active' : ''}`}
                    aria-expanded={isOpen}
                    onClick={() => {
                      setOpenLevelOne(isOpen ? '' : levelOne.key)
                      setOpenLevelTwo('')
                    }}
                  >
                    <span className="admin-nav__level-one-icon">
                      {ICONS[levelOne.iconKey] || <AppstoreOutlined />}
                    </span>
                    <span className="flex-1 text-left">{levelOne.label}</span>
                    <RightOutlined className={isOpen ? 'admin-nav__chevron--open' : ''} />
                  </button>
                  {isOpen && (
                    <div className="admin-nav__secondary">
                      {levelOne.children.map((levelTwo) => {
                        const isLevelTwoActive = (
                          activeLeaf?.ancestors[1] === levelTwo.key
                        )
                        return (
                          <button
                            type="button"
                            key={levelTwo.key}
                            className={`admin-nav__level-two ${
                              isLevelTwoActive ? 'admin-nav__level-two--active' : ''
                            }`}
                            aria-expanded={openLevelTwo === levelTwo.key}
                            onClick={() => setOpenLevelTwo(
                              openLevelTwo === levelTwo.key ? '' : levelTwo.key,
                            )}
                          >
                            <strong>{levelTwo.label}</strong>
                            <RightOutlined />
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
            >
              <div className="admin-nav__flyout-header">
                <p>{currentLevelOne.label}</p>
                <h2>{currentLevelTwo.label}</h2>
              </div>
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
