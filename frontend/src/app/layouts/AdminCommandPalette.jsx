import { SearchOutlined } from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import { Input, Modal } from 'antd'
import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { getAdminSettings } from '@/features/admin/system/manage-site-settings'
import { m } from '@/shared/config/i18n'
import { adminPath } from '@/shared/config/portals'
import {
  flattenAdminNavigation,
  searchAdminDestinations,
} from '../router/admin/admin-navigation'

const LISTBOX_ID = 'admin-palette-results'

/** Settings groups are tabs on one page; offering them here keeps one-step access. */
function useSettingsDestinations(enabled) {
  const settings = useQuery({
    queryKey: ['admin', 'settings', 'groups'],
    queryFn: getAdminSettings,
    enabled,
    staleTime: 5 * 60_000,
  })
  return useMemo(() => (settings.data?.groups || []).map((group) => ({
    key: `settings-${group.key}`,
    label: group.label,
    breadcrumb: [m.admin_nav_settings(), group.label],
    href: adminPath(`/settings?group=${group.key}`),
  })), [settings.data])
}

/** Quick jump to any admin destination: ⌘K / Ctrl+K or the sidebar search box. */
export default function AdminCommandPalette({ open, navigation, isSuperuser, onClose }) {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [cursor, setCursor] = useState(0)
  const settingsDestinations = useSettingsDestinations(open && isSuperuser)
  const destinations = useMemo(() => [
    ...flattenAdminNavigation(navigation),
    ...settingsDestinations,
  ], [navigation, settingsDestinations])
  const results = useMemo(
    () => searchAdminDestinations(destinations, query),
    [destinations, query],
  )
  const active = Math.min(cursor, Math.max(results.length - 1, 0))

  const close = () => {
    setQuery('')
    setCursor(0)
    onClose()
  }
  const handleKeyDown = (event) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      const step = event.key === 'ArrowDown' ? 1 : -1
      setCursor((active + step + results.length) % Math.max(results.length, 1))
    } else if (event.key === 'Enter' && results[active]) {
      event.preventDefault()
      navigate(results[active].href)
      close()
    }
  }

  return (
    <Modal
      open={open}
      onCancel={close}
      footer={null}
      closable={false}
      width={560}
      className="admin-palette"
      destroyOnHidden
      title={<span className="sr-only">{m.admin_nav_search_title()}</span>}
    >
      <Input
        autoFocus
        size="large"
        prefix={<SearchOutlined />}
        placeholder={m.admin_nav_search_placeholder()}
        aria-label={m.admin_nav_search_title()}
        role="combobox"
        aria-expanded="true"
        aria-controls={LISTBOX_ID}
        aria-activedescendant={results[active] ? `admin-palette-${results[active].key}` : undefined}
        value={query}
        onChange={(event) => {
          setQuery(event.target.value)
          setCursor(0)
        }}
        onKeyDown={handleKeyDown}
      />
      {results.length ? (
        <ul id={LISTBOX_ID} role="listbox" aria-label={m.admin_nav_search_title()} className="admin-palette__results">
          {results.map((destination, index) => (
            <li
              key={destination.key}
              id={`admin-palette-${destination.key}`}
              role="option"
              aria-selected={index === active}
            >
              <Link
                to={destination.href}
                tabIndex={-1}
                className={`admin-palette__item ${index === active ? 'admin-palette__item--active' : ''}`}
                onMouseMove={() => setCursor(index)}
                onClick={close}
              >
                <span className="admin-palette__label">{destination.label}</span>
                {destination.breadcrumb.length > 1 && (
                  <span className="admin-palette__trail">{destination.breadcrumb.slice(0, -1).join(' › ')}</span>
                )}
                {destination.badgeCount > 0 && (
                  <span className={`admin-nav__count ${destination.badgeOverdue > 0 ? 'admin-nav__count--urgent' : ''}`}>
                    {destination.badgeCount > 99 ? '99+' : destination.badgeCount}
                  </span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="admin-palette__empty">{m.admin_nav_search_empty()}</p>
      )}
      <p className="admin-palette__hint" aria-hidden="true">{m.admin_nav_search_hint()}</p>
    </Modal>
  )
}
