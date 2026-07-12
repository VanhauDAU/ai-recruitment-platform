import { CaretRightOutlined } from '@ant-design/icons'
import { App } from 'antd'
import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { CANDIDATE_MENU, candidateMenuItemLabel, findGroupKeyByPath } from '@/entities/account'
import { useAuth } from '@/features/auth'

// Sidebar trái của layout tài khoản: accordion CHỈ MỞ 1 NHÓM một lúc (mở nhóm
// này thì nhóm kia tự đóng), có animation, hover và trạng thái active theo
// route hiện tại. Dữ liệu menu dùng chung với dropdown avatar trên header.
export default function AccountSidebar({ onNavigate }) {
  const { pathname } = useLocation()
  const { user } = useAuth()
  const { message } = App.useApp()
  // Mặc định mở nhóm chứa trang đang xem; vào lại trang khác thì mở nhóm đó.
  const [openKey, setOpenKey] = useState(() => findGroupKeyByPath(pathname) || CANDIDATE_MENU[0].key)

  useEffect(() => {
    const groupKey = findGroupKeyByPath(pathname)
    if (groupKey) setOpenKey(groupKey)
  }, [pathname])

  function handleTodoClick(event) {
    event.preventDefault()
    message.info('Tính năng sẽ sớm ra mắt.')
  }

  return (
    <nav
      aria-label="Danh mục tài khoản"
      className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
    >
      {CANDIDATE_MENU.map((group) => (
        <SidebarGroup
          key={group.key}
          group={group}
          open={openKey === group.key}
          activePath={pathname}
          onToggle={() => setOpenKey((current) => (current === group.key ? null : group.key))}
          onTodoClick={handleTodoClick}
          onNavigate={onNavigate}
          user={user}
        />
      ))}
    </nav>
  )
}

function SidebarGroup({ group, open, activePath, onToggle, onTodoClick, onNavigate, user }) {
  const hasActiveChild = group.items.some((item) => item.path === activePath)

  return (
    <div className="border-b border-slate-100 last:border-b-0">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full cursor-pointer items-center gap-2.5 px-3 py-3 text-left text-slate-900 transition-colors duration-200 hover:bg-slate-50 sm:gap-3 sm:px-4 sm:py-3.5"
      >
        {/* Icon giữ màu thương hiệu khi nhóm đang chứa trang active để làm dấu
            nhận biết; phần TEXT luôn màu đen theo yêu cầu. */}
        <span className={`text-lg ${hasActiveChild ? 'text-[var(--brand-primary)]' : 'text-slate-400'}`}>
          {group.icon}
        </span>
        <span className="flex-1 text-sm font-semibold text-slate-900">{group.title}</span>
        <CaretRightOutlined
          className={`text-xs text-slate-400 transition-transform duration-300 ${open ? 'rotate-90' : ''}`}
        />
      </button>

      {/* Animation mượt: grid-rows 0fr -> 1fr, không cần đo chiều cao nội dung. */}
      <div className={`grid transition-[grid-template-rows] duration-300 ease-in-out ${open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
        <div className="overflow-hidden">
          <ul className="pb-2">
            {group.items.map((item) => (
              <li key={item.key}>
                <SidebarItem item={item} user={user} active={item.path === activePath} onTodoClick={onTodoClick} onNavigate={onNavigate} />
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}

function SidebarItem({ item, user, active, onTodoClick, onNavigate }) {
  // Text menu luôn màu đen; active nhận biết bằng nền brand-soft + thanh dọc trái.
  // Dùng `!text-slate-900` vì item là thẻ <a> (Link), nếu không sẽ bị màu link
  // mặc định của AntD đè lên.
  const base = 'relative flex w-full items-center py-2 pl-10 pr-3 text-left text-sm !text-slate-900 transition-colors duration-200 sm:pl-12 sm:pr-4'
  if (item.todo) {
    return (
      <button type="button" onClick={onTodoClick} className={`${base} cursor-pointer hover:bg-slate-50`}>
        {candidateMenuItemLabel(item, user)}
        <span className="ml-2 shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500">Sắp có</span>
      </button>
    )
  }
  return (
    <Link
      to={item.path}
      target={item.blank ? '_blank' : undefined}
      rel={item.blank ? 'noopener' : undefined}
      onClick={onNavigate}
      className={`${base} ${
        active
          ? 'bg-[var(--brand-primary-soft)] font-semibold before:absolute before:bottom-1 before:left-0 before:top-1 before:w-1 before:rounded-r-full before:bg-[var(--brand-primary)]'
          : 'hover:bg-[var(--brand-primary-soft)]/60'
      }`}
    >
      {candidateMenuItemLabel(item, user)}
    </Link>
  )
}
