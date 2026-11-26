import { BellOutlined, CheckOutlined, SettingOutlined } from '@ant-design/icons'
import { Badge, Button, Popover, Skeleton } from 'antd'
import { useState } from 'react'
import { Link } from 'react-router'
import { candidateNotificationTone } from '@/entities/notification/candidate-notification'
import { useMediaQuery } from '@/shared/hooks/use-media-query'
import BottomSheet from '@/shared/ui/BottomSheet'
import LineIcon from '@/shared/ui/icons/LineIcon'
import NotificationListItem from '@/shared/ui/NotificationListItem'
import NotificationSoundToggle from '@/shared/ui/NotificationSoundToggle'
import useCandidateNotifications from '../model/use-candidate-notifications'
import { m } from '@/shared/config/i18n'

const NOTIFICATION_SETTINGS_PATH = '/tai-khoan/cai-dat-nhan-email'

function PanelTitle({ unreadCount }) {
  return (
    <span className="flex items-center gap-2 text-base font-bold text-slate-800">
      {m.candidate_notifications_title()}
      {unreadCount > 0 && (
        <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-semibold text-red-600">{m.candidate_notifications_new({ count: unreadCount })}</span>
      )}
    </span>
  )
}

function PanelActions({ notifications, iconOnly = false }) {
  return (
    <>
      {notifications.unreadCount > 0 && (
        <Button
          type="text"
          size="small"
          icon={<CheckOutlined aria-hidden />}
          aria-label={iconOnly ? m.candidate_notifications_mark_all() : undefined}
          title={iconOnly ? m.candidate_notifications_mark_all() : undefined}
          loading={notifications.markingAll}
          onClick={notifications.markAllRead}
          className="!text-[var(--brand-primary)]"
        >
          {!iconOnly && m.candidate_notifications_mark_all()}
        </Button>
      )}
      <NotificationSoundToggle />
    </>
  )
}

function NotificationList({ notifications, mobile, onOpen }) {
  const { items, isPending, isError } = notifications
  if (isPending) return <div className="p-4"><Skeleton active avatar paragraph={{ rows: 2 }} /></div>
  if (isError) return <p className="p-5 text-center text-xs text-red-600">{m.candidate_notifications_error()}</p>
  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center px-6 py-10 text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-[var(--brand-primary-soft)] text-2xl text-[var(--brand-primary)]">
          <BellOutlined />
        </span>
        <p className="mt-3 text-sm font-semibold text-slate-800">{m.candidate_notifications_empty()}</p>
        <p className="mt-1 text-xs leading-5 text-slate-500">{m.candidate_notifications_empty_hint()}</p>
      </div>
    )
  }
  return items.map((item) => (
    <NotificationListItem
      key={item.public_id}
      item={item}
      tone={candidateNotificationTone(item.event_type)}
      time={item.delivered_at}
      compact={!mobile}
      onOpen={onOpen}
    />
  ))
}

function SettingsLink({ onClick }) {
  return (
    <Link to={NOTIFICATION_SETTINGS_PATH} onClick={onClick} className="inline-flex items-center gap-1.5 text-xs font-semibold !text-[var(--brand-primary)]">
      <SettingOutlined aria-hidden /> {m.candidate_notifications_settings()}
    </Link>
  )
}

/** Chuông thông báo ứng viên: popover trên desktop, tấm trượt từ đáy trên mobile. */
export default function CandidateNotificationBell() {
  const [open, setOpen] = useState(false)
  const mobile = useMediaQuery('(max-width: 767.98px)')
  const notifications = useCandidateNotifications({ open })
  const close = () => setOpen(false)
  const handleOpenItem = (item) => {
    notifications.markRead(item)
    close()
  }

  const trigger = (
    <Badge count={notifications.unreadCount} size="small" overflowCount={99} offset={[-6, 6]}>
      <button
        type="button"
        aria-label={m.candidate_notifications_open()}
        aria-expanded={open}
        onClick={mobile ? () => setOpen(true) : undefined}
        className={`flex h-10 w-10 cursor-pointer items-center justify-center rounded-full text-[22px] transition hover:bg-slate-100 hover:text-[var(--brand-primary)] active:scale-95 ${
          open ? 'bg-slate-100 text-[var(--brand-primary)]' : 'text-slate-700'
        }`}
      >
        <LineIcon name="bell" strokeWidth={1.8} />
      </button>
    </Badge>
  )

  if (mobile) {
    return (
      <>
        {trigger}
        <BottomSheet
          open={open}
          onClose={close}
          title={<PanelTitle unreadCount={notifications.unreadCount} />}
          extra={<PanelActions notifications={notifications} iconOnly />}
          footer={<SettingsLink onClick={close} />}
        >
          <NotificationList notifications={notifications} mobile onOpen={handleOpenItem} />
        </BottomSheet>
      </>
    )
  }

  const panel = (
    <div className="w-[360px] max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl bg-white">
      <div className="flex items-center justify-between gap-2 border-b border-gray-100 py-2.5 pl-4 pr-2">
        <PanelTitle unreadCount={notifications.unreadCount} />
        <div className="flex items-center gap-1"><PanelActions notifications={notifications} /></div>
      </div>
      <div className="max-h-[420px] overflow-y-auto overscroll-contain">
        <NotificationList notifications={notifications} onOpen={handleOpenItem} />
      </div>
      <div className="border-t border-gray-100 px-4 py-2.5 text-right">
        <SettingsLink onClick={close} />
      </div>
    </div>
  )

  return (
    <Popover
      content={panel}
      open={open}
      onOpenChange={setOpen}
      trigger="click"
      placement="bottomRight"
      styles={{ container: { padding: 0 } }}
    >
      {trigger}
    </Popover>
  )
}
