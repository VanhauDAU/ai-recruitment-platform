import {
  CaretRightOutlined, CheckCircleFilled, IdcardOutlined,
  LogoutOutlined, WarningFilled,
} from '@ant-design/icons'
import { Avatar, Badge, Dropdown } from 'antd'
import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router'
import { CANDIDATE_MENU } from '@/entities/account/account'
import { connectPath, useConnectUnreadCount } from '@/entities/messaging/conversation'
import { useSiteSettings } from '@/entities/system/site-settings'
import { CandidateNotificationBell } from '@/features/main/account/view-candidate-notifications'
import { m } from '@/shared/config/i18n'
import { useMediaQuery } from '@/shared/hooks/use-media-query'
import LineIcon from '@/shared/ui/icons/LineIcon'

const SECTIONS = CANDIDATE_MENU

function Section({ section, open, onToggle, onItem, activePathname }) {
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
                  {it.label}
                </button>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

/** Thẻ tài khoản ứng viên: dùng trong dropdown avatar (desktop) và tấm đáy (mobile). */
export function CandidateAccountPanel({ user, logout, onClose, className = '' }) {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const [openKey, setOpenKey] = useState(
    () => SECTIONS.find((section) => section.items.some((item) => item.path === pathname))?.key || 'search',
  )
  const verified = user?.email_verified

  useEffect(() => {
    const activeSection = SECTIONS.find((section) => section.items.some((item) => item.path === pathname))
    if (activeSection) setOpenKey(activeSection.key)
  }, [pathname])

  function handleItem(it) {
    onClose()
    navigate(it.path)
  }

  return (
    <div className={`flex flex-col overflow-hidden bg-white ${className}`}>
      <div className="flex shrink-0 items-center gap-3 px-4 py-3">
        <Avatar size={48} src={user?.avatar_url || undefined} icon={<IdcardOutlined />} />
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-gray-900">{user?.full_name || 'Ứng viên'}</p>
          {verified ? (
            <p className="flex items-center gap-1 text-xs text-[var(--brand-primary)]"><CheckCircleFilled /> Tài khoản đã xác thực</p>
          ) : (
            <Link to="/tai-khoan/xac-thuc-email" onClick={onClose} className="flex items-center gap-1 text-xs text-amber-600 hover:underline">
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
          <Section
            key={s.key}
            section={s}
            activePathname={pathname}
            open={openKey === s.key}
            onToggle={() => setOpenKey((current) => current === s.key ? null : s.key)}
            onItem={handleItem}
          />
        ))}
      </div>

      <div className="shrink-0 border-t border-gray-100 p-3">
        <button
          type="button"
          onClick={() => { onClose(); logout() }}
          className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-full bg-[var(--brand-primary-soft)] py-2 text-sm font-semibold text-[var(--brand-primary)] transition-colors hover:bg-[var(--brand-primary)] hover:text-white"
        >
          <LogoutOutlined /> Đăng xuất
        </button>
      </div>
    </div>
  )
}

/** Lối vào ProCV Connect kèm số hội thoại có tin mới; ẩn khi admin tắt tính năng. */
function ConnectShortcut() {
  const unread = useConnectUnreadCount('candidate')
  return (
    <Link
      to={connectPath('candidate')}
      aria-label={unread ? m.connect_open_inbox_unread({ count: unread }) : m.connect_open_inbox()}
      title={m.connect_title()}
      className="flex h-10 w-10 items-center justify-center rounded-full text-[22px] !text-slate-700 transition hover:bg-slate-100 hover:!text-[var(--brand-primary)] active:scale-95"
    >
      <Badge count={unread} size="small" overflowCount={99} offset={[2, -2]}>
        <LineIcon name="messageCircleMore" strokeWidth={1.8} className="block text-[22px] text-current" />
      </Badge>
    </Link>
  )
}

/**
 * Cụm hành động ứng viên trên header. `compactMobile`: màn hẹp giữ chuông và
 * tin nhắn; avatar chuyển xuống thanh tab dưới (`MobileTabBar`).
 */
export default function CandidateUserMenu({ user, logout, compactMobile = false }) {
  const [open, setOpen] = useState(false)
  // Chạm trên màn cảm ứng sinh cả mouseenter lẫn click: hover mở rồi click đóng ngay.
  const canHover = useMediaQuery('(hover: hover)')
  const desktopOnly = compactMobile ? 'hidden md:flex' : 'flex'
  const connectEnabled = useSiteSettings().settings.connect_enabled === true

  return (
    <div className="flex items-center gap-0.5 md:gap-3">
      <CandidateNotificationBell />

      {connectEnabled && <ConnectShortcut />}

      <Dropdown
        open={open}
        onOpenChange={setOpen}
        trigger={canHover ? ['hover', 'click'] : ['click']}
        placement="bottomRight"
        popupRender={() => (
          <CandidateAccountPanel
            user={user}
            logout={logout}
            onClose={() => setOpen(false)}
            className="max-h-[calc(100dvh-5rem)] w-[360px] max-w-[calc(100vw-2rem)] rounded-2xl border border-gray-100 shadow-xl"
          />
        )}
      >
        <button type="button" aria-label="Mở menu tài khoản" aria-expanded={open} className={`${desktopOnly} cursor-pointer items-center gap-1`}>
          <Avatar size={38} src={user?.avatar_url || undefined} icon={<IdcardOutlined />} />
          <CaretRightOutlined className={`text-xs text-gray-400 transition-transform duration-300 ${open ? '-rotate-90' : 'rotate-90'}`} />
        </button>
      </Dropdown>
    </div>
  )
}
