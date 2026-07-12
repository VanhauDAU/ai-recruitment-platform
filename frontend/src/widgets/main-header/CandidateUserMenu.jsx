import {
  BellOutlined, CaretRightOutlined, CheckCircleFilled, IdcardOutlined,
  LogoutOutlined, MessageOutlined, WarningFilled,
} from '@ant-design/icons'
import { App, Avatar, Badge, Dropdown } from 'antd'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { CANDIDATE_MENU, candidateMenuItemLabel } from '@/entities/account'

// Section lấy từ config dùng chung với sidebar trang tài khoản (một nguồn duy nhất).
// Nhóm A (search, cv) mở/đóng độc lập; nhóm B (email, account, upgrade) là accordion: mở 1 đóng 2 còn lại.
const GROUP_B = ['email', 'account', 'upgrade']
const SECTIONS = CANDIDATE_MENU

function Section({ section, open, onToggle, onItem, user }) {
  return (
    <div className="border-b border-gray-100 last:border-b-0">
      <button
        onClick={onToggle}
        className="flex w-full cursor-pointer items-center gap-3 rounded-lg px-5 py-3 text-left transition-colors hover:bg-gray-50"
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
      {/* Animation mượt: grid-rows 0fr -> 1fr, không cần biết chiều cao nội dung */}
      <div className={`grid transition-[grid-template-rows] duration-300 ease-in-out ${open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
        <div className="overflow-hidden">
          <div className="pb-2">
            {section.items.map((it) => (
              <button
                key={it.key || it.label}
                onClick={() => onItem(it)}
                className="flex w-full cursor-pointer items-center rounded-lg py-2 pl-[52px] pr-5 text-left text-sm text-slate-900 transition-colors hover:bg-[var(--brand-primary-soft)]"
              >
                {candidateMenuItemLabel(it, user)}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

export default function CandidateUserMenu({ user, logout }) {
  const navigate = useNavigate()
  const { message } = App.useApp()
  const [open, setOpen] = useState(false)
  const [openKeys, setOpenKeys] = useState(() => new Set(['search', 'cv']))
  const verified = user?.email_verified

  function toggleSection(key) {
    setOpenKeys((prev) => {
      const next = new Set(prev)
      if (next.has(key)) {
        next.delete(key)
      } else {
        if (GROUP_B.includes(key)) GROUP_B.forEach((k) => next.delete(k)) // mở 1 mục nhóm B thì đóng 2 mục còn lại
        next.add(key)
      }
      return next
    })
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
    <div className="w-[380px] max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-xl">
      <div className="flex items-center gap-3 px-5 py-4">
        <Avatar size={56} src={user?.avatar_url || undefined} icon={<IdcardOutlined />} />
        <div className="min-w-0">
          <p className="truncate text-base font-semibold text-gray-900">{user?.full_name || 'Ứng viên'}</p>
          {verified ? (
            <p className="flex items-center gap-1 text-sm text-[var(--brand-primary)]"><CheckCircleFilled /> Tài khoản đã xác thực</p>
          ) : (
            <Link to="/tai-khoan/xac-thuc-email" onClick={() => setOpen(false)} className="flex items-center gap-1 text-sm text-amber-600 hover:underline">
              <WarningFilled /> Tài khoản chưa xác thực
            </Link>
          )}
          <p className="mt-0.5 truncate text-xs text-gray-400">
            {user?.public_id && <>ID {user.public_id}<span className="mx-1.5">|</span></>}{user?.email}
          </p>
        </div>
      </div>

      <div className="border-t border-gray-100 px-2">
        {SECTIONS.map((s) => (
          <Section key={s.key} section={s} user={user} open={openKeys.has(s.key)} onToggle={() => toggleSection(s.key)} onItem={handleItem} />
        ))}
      </div>

      <div className="p-3">
        <button
          onClick={() => { setOpen(false); logout() }}
          className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-full bg-[var(--brand-primary-soft)] py-2.5 text-sm font-semibold text-[var(--brand-primary)] transition-colors hover:bg-[var(--brand-primary)] hover:text-white"
        >
          <LogoutOutlined /> Đăng xuất
        </button>
      </div>
    </div>
  )

  return (
    <div className="flex items-center gap-4">
      <Dropdown trigger={['hover']} placement="bottomRight" popupRender={() => notifPanel} mouseLeaveDelay={0.2}>
        <Badge count={1} size="small">
          <button className="flex cursor-pointer text-xl text-gray-500 transition-colors hover:text-[var(--brand-primary)]">
            <BellOutlined />
          </button>
        </Badge>
      </Dropdown>

      <button className="flex cursor-pointer text-xl text-gray-500 transition-colors hover:text-[var(--brand-primary)]" onClick={() => message.info('Tính năng sẽ sớm ra mắt.')}>
        <MessageOutlined />
      </button>

      <Dropdown open={open} onOpenChange={setOpen} trigger={['hover']} placement="bottomRight" popupRender={() => userPanel} mouseLeaveDelay={0.2}>
        <button className="flex cursor-pointer items-center gap-1">
          <Avatar size={38} src={user?.avatar_url || undefined} icon={<IdcardOutlined />} />
          <CaretRightOutlined className={`text-xs text-gray-400 transition-transform duration-300 ${open ? '-rotate-90' : 'rotate-90'}`} />
        </button>
      </Dropdown>
    </div>
  )
}
