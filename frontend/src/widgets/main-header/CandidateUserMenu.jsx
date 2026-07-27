import {
  BellOutlined, CaretRightOutlined, CheckCircleFilled, IdcardOutlined,
  LogoutOutlined, MessageOutlined, WarningFilled,
} from '@ant-design/icons'
import { Avatar, Dropdown } from 'antd'
import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router'
import { CANDIDATE_MENU, candidateMenuItemLabel } from '@/entities/account'
import { message } from '@/shared/lib/toast'

const SECTIONS = CANDIDATE_MENU

function Section({ section, open, onToggle, onItem, user, activePathname }) {
  const panelId = `candidate-user-menu-${section.key}`

  return (
    <div className="border-b border-gray-100 last:border-b-0">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        aria-controls={panelId}
        className="flex w-full cursor-pointer items-center gap-3 rounded-lg px-4 py-2.5 text-left transition-colors hover:bg-gray-50"
      >
        <span className="relative text-lg text-gray-500">
          {section.icon}
          {section.dot && (
            <span className="absolute -bottom-0.5 -right-1 h-2 w-2 rounded-full bg-[var(--brand-primary)] ring-2 ring-white" />
          )}
        </span>
        <span className="flex-1 text-sm font-semibold text-slate-900">{section.title}</span>
        <CaretRightOutlined className={`text-xs text-gray-400 transition-transform duration-300 ${open ? 'rotate-90' : ''}`} />
      </button>
      <div
        id={panelId}
        aria-hidden={!open}
        inert={open ? undefined : true}
        className={`grid transition-[grid-template-rows] duration-200 ease-in-out ${open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}
      >
        <div className="overflow-hidden">
          <div className="pb-2">
            {section.items.map((it) => {
              const isActive = it.path === activePathname

              return (
                <button
                  type="button"
                  key={it.key || it.label}
                  tabIndex={open ? 0 : -1}
                  onClick={() => onItem(it)}
                  className={`flex w-full cursor-pointer items-center rounded-lg py-2 pl-[48px] pr-4 text-left text-sm transition-colors hover:bg-[var(--brand-primary-soft)] ${
                    isActive
                      ? 'bg-[var(--brand-primary-soft)] font-semibold text-[var(--brand-primary)]'
                      : 'text-slate-900'
                  }`}
                >
                  {candidateMenuItemLabel(it, user)}
                </button>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

export default function CandidateUserMenu({ user, logout }) {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const [open, setOpen] = useState(false)
  const [openKey, setOpenKey] = useState(
    () => SECTIONS.find((section) => section.items.some((item) => item.path === pathname))?.key || 'search',
  )
  const verified = user?.email_verified

  useEffect(() => {
    const activeSection = SECTIONS.find((section) => section.items.some((item) => item.path === pathname))
    if (activeSection) setOpenKey(activeSection.key)
  }, [pathname])

  function toggleSection(key) {
    setOpenKey((current) => current === key ? null : key)
  }

  function handleItem(it) {
    setOpen(false)
    if (it.todo || !it.path) message.info('Tính năng sẽ sớm ra mắt.')
    else if (it.blank) window.open(it.path, '_blank', 'noopener')
    else navigate(it.path)
  }

  const notifPanel = (
    <div className="w-[340px] max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-xl">
      <p className="border-b border-gray-100 px-5 py-3 text-sm font-semibold text-gray-800">Thông báo</p>
      <div className="flex flex-col items-center gap-2 px-5 py-10 text-center text-gray-400">
        <BellOutlined className="text-3xl" />
        <span className="text-sm">Bạn chưa có thông báo mới</span>
      </div>
    </div>
  )

  const userPanel = (
    <div className="flex max-h-[calc(100dvh-5rem)] w-[360px] max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-xl">
      <div className="flex shrink-0 items-center gap-3 px-4 py-3">
        <Avatar size={48} src={user?.avatar_url || undefined} icon={<IdcardOutlined />} />
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-gray-900">{user?.full_name || 'Ứng viên'}</p>
          {verified ? (
            <p className="flex items-center gap-1 text-xs text-[var(--brand-primary)]"><CheckCircleFilled /> Tài khoản đã xác thực</p>
          ) : (
            <Link to="/tai-khoan/xac-thuc-email" onClick={() => setOpen(false)} className="flex items-center gap-1 text-xs text-amber-600 hover:underline">
              <WarningFilled /> Tài khoản chưa xác thực
            </Link>
          )}
          <p className="mt-0.5 truncate text-xs text-gray-400">
            {user?.public_id && <>ID {user.public_id}<span className="mx-1.5">|</span></>}{user?.email}
          </p>
        </div>
      </div>

      <div className="min-h-0 overflow-y-auto overscroll-contain border-t border-gray-100 px-2 [scrollbar-width:thin]">
        {SECTIONS.map((s) => (
          <Section key={s.key} section={s} user={user} activePathname={pathname} open={openKey === s.key} onToggle={() => toggleSection(s.key)} onItem={handleItem} />
        ))}
      </div>

      <div className="shrink-0 border-t border-gray-100 p-3">
        <button
          type="button"
          onClick={() => { setOpen(false); logout() }}
          className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-full bg-[var(--brand-primary-soft)] py-2 text-sm font-semibold text-[var(--brand-primary)] transition-colors hover:bg-[var(--brand-primary)] hover:text-white"
        >
          <LogoutOutlined /> Đăng xuất
        </button>
      </div>
    </div>
  )

  return (
    <div className="flex items-center gap-4">
      <Dropdown trigger={['hover', 'click']} placement="bottomRight" popupRender={() => notifPanel}>
        <button type="button" aria-label="Mở thông báo" className="flex cursor-pointer text-xl text-gray-500 transition-colors hover:text-[var(--brand-primary)]">
          <BellOutlined />
        </button>
      </Dropdown>

      <button type="button" aria-label="Mở tin nhắn" className="flex cursor-pointer text-xl text-gray-500 transition-colors hover:text-[var(--brand-primary)]" onClick={() => message.info('Tính năng sẽ sớm ra mắt.')}>
        <MessageOutlined />
      </button>

      <Dropdown open={open} onOpenChange={setOpen} trigger={['hover', 'click']} placement="bottomRight" popupRender={() => userPanel}>
        <button type="button" aria-label="Mở menu tài khoản" aria-expanded={open} className="flex cursor-pointer items-center gap-1">
          <Avatar size={38} src={user?.avatar_url || undefined} icon={<IdcardOutlined />} />
          <CaretRightOutlined className={`text-xs text-gray-400 transition-transform duration-300 ${open ? '-rotate-90' : 'rotate-90'}`} />
        </button>
      </Dropdown>
    </div>
  )
}
