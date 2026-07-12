import {
  BookOutlined,
  BulbOutlined,
  CompassOutlined,
  DownOutlined,
  DollarOutlined,
  LineChartOutlined,
  ReadOutlined,
  RightOutlined,
  RocketOutlined,
} from '@ant-design/icons'
import { Drawer, Tag } from 'antd'
import { useEffect, useState } from 'react'
import { getBlogCategories, getBlogHome } from '@/api/blogService'
import { blogCategoryPath, blogPostPath } from '@/pages/main/blog/blogPaths'
import BrandLogo from '../brand/BrandLogo'
import { flattenMenuItems, isMenuActive } from './headerNavigationConfig'

const HANDBOOK_ICONS = [CompassOutlined, BulbOutlined, DollarOutlined, ReadOutlined, RocketOutlined, LineChartOutlined]

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
              {open && menu.key === 'handbook' && (
                <span className="absolute -bottom-2 left-1/2 z-50 h-4 w-4 -translate-x-1/2 rotate-45 rounded-sm border-l border-t border-gray-100 bg-white" />
              )}
            </button>

            {open && (
              menu.key === 'handbook'
                ? <HandbookDropdown onSelect={onSelect} />
                : <StandardDropdown menu={menu} onSelect={onSelect} />
            )}
          </div>
        )
      })}
    </nav>
  )
}

function StandardDropdown({ menu, onSelect }) {
  return (
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
  )
}

function HandbookDropdown({ onSelect }) {
  const [categories, setCategories] = useState([])
  const [featured, setFeatured] = useState([])

  useEffect(() => {
    let cancelled = false
    getBlogCategories().then((data) => { if (!cancelled) setCategories(data || []) }).catch(() => {})
    getBlogHome().then((data) => { if (!cancelled) setFeatured((data?.featured || []).slice(0, 2)) }).catch(() => {})
    return () => { cancelled = true }
  }, [])

  return (
    <div className="absolute left-1/2 top-full z-40 grid w-[min(52rem,calc(100vw-2rem))] -translate-x-1/2 grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)] overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-xl shadow-slate-900/15">
      <div className="border-r border-slate-100 p-4">
        <div className="space-y-0.5">
          {categories.length > 0 ? categories.map((category, index) => {
            const Icon = HANDBOOK_ICONS[index % HANDBOOK_ICONS.length]
            return (
              <button
                key={category.slug}
                type="button"
                onClick={() => onSelect({ to: blogCategoryPath(category.slug) })}
                className="group flex w-full cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-semibold text-slate-700 transition hover:bg-[var(--brand-primary-soft)] hover:text-[var(--brand-primary)]"
              >
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-100 text-sm text-[var(--brand-primary)] transition group-hover:bg-white">
                  <Icon />
                </span>
                <span className="truncate">{category.name}</span>
              </button>
            )
          }) : (
            Array.from({ length: 6 }).map((_, index) => <div key={index} className="h-11 animate-pulse rounded-lg bg-slate-100" />)
          )}
        </div>
      </div>

      <div className="p-5">
        <h3 className="text-sm font-bold text-slate-800">Bài viết nổi bật</h3>
        <div className="mt-3 space-y-3">
          {featured.length > 0 ? featured.map((post) => (
            <button
              key={post.public_id}
              type="button"
              onClick={() => onSelect({ to: blogPostPath(post.slug) })}
              className="group flex w-full cursor-pointer gap-3 rounded-xl p-1 text-left transition hover:bg-slate-50"
            >
              <span className="h-[76px] w-[112px] shrink-0 overflow-hidden rounded-lg bg-slate-100">
                {post.thumbnail_url ? (
                  <img src={post.thumbnail_url} alt="" className="h-full w-full object-cover transition duration-300 group-hover:scale-105" />
                ) : (
                  <span className="flex h-full w-full items-center justify-center text-lg font-black text-[var(--brand-primary)]/35"><BookOutlined /></span>
                )}
              </span>
              <span className="min-w-0 pt-0.5">
                <span className="line-clamp-2 block text-sm font-semibold leading-5 text-slate-700 transition group-hover:text-[var(--brand-primary)]">{post.title}</span>
                {post.excerpt && <span className="mt-1 line-clamp-2 block text-xs leading-4 text-slate-500">{post.excerpt}</span>}
              </span>
            </button>
          )) : (
            Array.from({ length: 2 }).map((_, index) => <div key={index} className="h-[76px] animate-pulse rounded-xl bg-slate-100" />)
          )}
        </div>
        <button
          type="button"
          onClick={() => onSelect({ to: '/blog' })}
          className="mt-4 inline-flex cursor-pointer items-center gap-2 text-sm font-semibold text-[var(--brand-primary)] transition hover:gap-3"
        >
          Xem thêm bài viết nổi bật <RightOutlined className="text-xs" />
        </button>
      </div>
    </div>
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
