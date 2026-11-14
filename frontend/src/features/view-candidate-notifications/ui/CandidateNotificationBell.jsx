import { BellOutlined } from '@ant-design/icons'
import { Badge, Button, Empty, Popover, Skeleton } from 'antd'
import { useState } from 'react'
import { Link } from 'react-router'
import { candidateNotificationTone } from '@/entities/candidate-notification'
import NotificationListItem from '@/shared/ui/NotificationListItem'
import useCandidateNotifications from '../model/use-candidate-notifications'

const NOTIFICATION_SETTINGS_PATH = '/tai-khoan/cai-dat-nhan-email'

export default function CandidateNotificationBell() {
  const [open, setOpen] = useState(false)
  const notifications = useCandidateNotifications({ open })
  const { items, isPending, isError } = notifications

  const panel = (
    <div className="w-[340px] max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl bg-white">
      <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
        <strong className="text-sm text-slate-800">Thông báo</strong>
        {notifications.unreadCount > 0 && (
          <Button type="link" size="small" loading={notifications.markingAll} onClick={notifications.markAllRead}>
            Đánh dấu đã đọc
          </Button>
        )}
      </div>
      <div className="max-h-[420px] overflow-y-auto">
        {isPending && <div className="p-4"><Skeleton active paragraph={{ rows: 3 }} /></div>}
        {isError && <p className="p-5 text-center text-xs text-red-600">Không tải được thông báo.</p>}
        {!isPending && !isError && items.length === 0 && (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Bạn chưa có thông báo mới" className="py-7" />
        )}
        {items.map((item) => (
          <NotificationListItem
            key={item.public_id}
            item={item}
            tone={candidateNotificationTone(item.event_type)}
            time={item.delivered_at}
            compact
            onOpen={(value) => {
              notifications.markRead(value)
              setOpen(false)
            }}
          />
        ))}
      </div>
      <div className="border-t border-gray-100 px-4 py-2.5 text-right">
        <Link to={NOTIFICATION_SETTINGS_PATH} onClick={() => setOpen(false)} className="text-xs font-semibold text-emerald-600">
          Cài đặt thông báo
        </Link>
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
      <Badge count={notifications.unreadCount} size="small" overflowCount={99}>
        <button type="button" aria-label="Mở thông báo" className="flex cursor-pointer text-xl text-gray-500 transition-colors hover:text-[var(--brand-primary)]">
          <BellOutlined />
        </button>
      </Badge>
    </Popover>
  )
}
