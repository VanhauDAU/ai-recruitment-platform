import { BellOutlined, CheckCircleFilled, ExclamationCircleFilled } from '@ant-design/icons'
import { Badge, Button, Popover } from 'antd'
import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { adminPath } from '@/shared/config/portals'
import { buildQueues, formatAge } from '@/entities/dashboard/admin-dashboard'
import './admin-queue-bell.css'

const formatNumber = (value) => Number(value || 0).toLocaleString('vi-VN')

/** Header bell: the same urgency-sorted queues as the dashboard, one click away. */
export default function AdminQueueBell({ summary }) {
  const [open, setOpen] = useState(false)
  const now = summary ? new Date(summary.generated_at).getTime() : 0
  const queue = useMemo(() => buildQueues(summary?.queues, now), [summary?.queues, now])
  const label = queue.total
    ? `${formatNumber(queue.total)} mục cần xử lý${queue.overdue ? `, ${formatNumber(queue.overdue)} quá hạn` : ''}`
    : 'Không có mục cần xử lý'

  const content = (
    <div className="admin-bell">
      <div className="admin-bell__header">
        <strong>Cần xử lý</strong>
        <span>{label}</span>
      </div>
      {queue.pending.length ? (
        <ul className="admin-bell__list">
          {queue.pending.map((item) => (
            <li key={item.key}>
              <Link
                to={item.to}
                className={`admin-bell__item admin-bell__item--${item.tone}`}
                onClick={() => setOpen(false)}
              >
                <span className="admin-bell__item-main">
                  <span className="admin-bell__item-label">{item.label}</span>
                  <span className="admin-bell__item-meta">
                    {item.overdue > 0
                      ? <><ExclamationCircleFilled aria-hidden="true" /> {formatNumber(item.overdue)} quá hạn</>
                      : item.oldest_at && `Chờ lâu nhất ${formatAge(item.oldest_at, now)}`}
                  </span>
                </span>
                <strong>{formatNumber(item.count)}</strong>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="admin-bell__empty">
          <CheckCircleFilled aria-hidden="true" /> Đã xử lý hết các hàng chờ.
        </p>
      )}
      <Link to={adminPath('/dashboard')} className="admin-bell__footer" onClick={() => setOpen(false)}>
        Mở bảng điều khiển
      </Link>
    </div>
  )

  return (
    <Popover
      content={content}
      trigger="click"
      placement="bottomRight"
      open={open}
      onOpenChange={setOpen}
      arrow={false}
    >
      <Badge
        count={queue.total}
        overflowCount={99}
        size="small"
        color={queue.overdue ? '#d03b3b' : '#475569'}
        offset={[-6, 6]}
      >
        <Button className="admin-icon-button" icon={<BellOutlined />} aria-label={label} />
      </Badge>
    </Popover>
  )
}
