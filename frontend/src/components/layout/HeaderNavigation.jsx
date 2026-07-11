import { DownOutlined, RightOutlined } from '@ant-design/icons'
import { Drawer, Tag } from 'antd'
import BrandLogo from '../brand/BrandLogo'
import { flattenMenuItems, isMenuActive } from './headerNavigationConfig'

function NavigationItem({ item, onSelect, mobile = false }) {
  return (
    <button
      onClick={() => onSelect(item)}
      className={mobile
        ? 'flex w-full cursor-pointer items-center gap-2 py-2 pl-8 pr-5 text-left text-sm text-gray-600 hover:text-[var(--brand-primary)]'
        : 'group flex cursor-pointer items-center gap-2 py-1.5 text-left text-sm leading-snug text-gray-700 hover:text-[var(--brand-primary)]'}
    >
      {item.icon && (
        <span className="shrink-0 text-[var(--brand-primary)] text-base">{item.icon}</span>
      )}
      <span className={mobile ? '' : 'max-w-[220px]'}>{item.label}</span>
      {item.badge && (
        <Tag color="green" className="!mr-0 !text-[10px] !leading-4 shrink-0">
          {item.badge}
        </Tag>
      )}
      {!mobile && (
        <RightOutlined className="shrink-0 -translate-x-1 text-[10px] text-[var(--brand-primary)] opacity-0 transition-all duration-200 group-hover:translate-x-0 group-hover:opacity-100" />
      )}
    </button>
  )
}

export function DesktopNavigation({ menus, openKey, pathname, onOpen, onSelect }) {
  return (
    <nav
      className="hidden flex-1 items-stretch gap-6 text-sm font-medium text-gray-700 md:flex"
      onMouseLeave={() => onOpen(null)}
    >
      {menus.map((menu) => {
        const active = isMenuActive(menu, pathname)
        const open = openKey === menu.key
        return (
          <div
            key={menu.key}
            className="relative flex items-center"
            onMouseEnter={() => onOpen(menu.key)}
          >
            <button
              onClick={() => (menu.to ? onSelect(menu) : onOpen(menu.key))}
              aria-current={active ? 'page' : undefined}
              className={`relative flex h-16 cursor-pointer items-center gap-1 px-1 transition ${
                active || open ? 'text-[var(--brand-primary)]' : 'hover:text-[var(--brand-primary)]'
              }`}
            >
              {menu.label}
              <DownOutlined className={`text-[10px] transition-transform ${open ? 'rotate-180' : ''}`} />
              <span className={`absolute bottom-0 left-0 h-0.5 rounded-full bg-[var(--brand-primary)] transition-all duration-200 ${
                active ? 'w-full opacity-100' : 'w-0 opacity-0'
              }`} />
            </button>

            {open && (
              <div className="absolute left-0 top-full z-40 flex w-max max-w-[calc(100vw-3rem)] divide-x divide-gray-100 rounded-xl border border-gray-100 bg-white py-4 shadow-xl">
                {menu.columns.map((column, columnIndex) => (
                  <div key={columnIndex} className="space-y-5 px-6">
                    {column.map((group, groupIndex) => (
                      <div key={groupIndex}>
                        {group.title && (
                          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
                            {group.title}
                          </p>
                        )}
                        <div className={group.cols === 2 ? 'grid grid-cols-2 gap-x-8' : ''}>
                          {group.items.map((item) => (
                            <NavigationItem key={item.label} item={item} onSelect={onSelect} />
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      })}
    </nav>
  )
}

export function MobileNavigation({ children, menus, open, openKey, onClose, onOpen, onSelect }) {
  return (
    <Drawer
      open={open}
      onClose={onClose}
      placement="left"
      size={300}
      styles={{ body: { padding: 0 } }}
      title={<BrandLogo variant="full" imageClassName="h-8 max-w-[160px]" />}
      className="md:hidden"
    >
      <nav className="flex flex-col py-1">
        {menus.map((menu) => {
          const expanded = openKey === menu.key
          return (
            <div key={menu.key} className="border-b border-gray-100">
              <button
                onClick={() => onOpen(expanded ? null : menu.key)}
                className="flex w-full cursor-pointer items-center justify-between px-5 py-3.5 text-left text-base font-semibold text-gray-800"
              >
                {menu.label}
                <DownOutlined className={`text-xs text-gray-400 transition-transform ${expanded ? 'rotate-180' : ''}`} />
              </button>
              <div className={`grid transition-[grid-template-rows] duration-300 ease-in-out ${expanded ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
                <div className="overflow-hidden">
                  <div className="pb-2">
                    {flattenMenuItems(menu).map((item) => (
                      <NavigationItem key={item.label} item={item} onSelect={onSelect} mobile />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </nav>
      {children}
    </Drawer>
  )
}
