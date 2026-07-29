import {
  CheckCircleOutlined,
  ClockCircleOutlined,
  HistoryOutlined,
} from '@ant-design/icons'
import { Empty, Tag, Timeline } from 'antd'
import { KIND_LABELS, SURFACE_LABELS } from '../model/announcement-options'

const AUDIT_LABELS = {
  announcement_create: 'Tạo thông báo',
  announcement_rename: 'Đổi tên vận hành',
  announcement_create_revision: 'Tạo revision mới',
  announcement_publish: 'Phát hành revision',
  announcement_pause: 'Tạm dừng',
  announcement_resume: 'Tiếp tục',
  announcement_archive: 'Lưu trữ',
  announcement_duplicate: 'Nhân bản thông báo',
  announcement_create_from_duplicate: 'Tạo từ bản sao',
}

function formatDate(value) {
  if (!value) return 'Chưa ghi nhận'
  return new Intl.DateTimeFormat('vi-VN', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Ho_Chi_Minh',
  }).format(new Date(value))
}

export function RevisionHistory({ revisions = [] }) {
  if (!revisions.length) return <Empty description="Chưa có revision" />
  return (
    <Timeline
      className="announcement-history"
      items={revisions.map((revision) => ({
        color: revision.is_active ? 'green' : 'gray',
        icon: revision.is_active ? <CheckCircleOutlined /> : <HistoryOutlined />,
        content: (
          <article className="announcement-history__entry">
            <header>
              <strong>Revision {revision.number}</strong>
              {revision.is_active && <Tag color="green">Đang phát hành</Tag>}
              {revision.published_at && <Tag color="blue">Đã publish</Tag>}
            </header>
            <p>{revision.message_vi}</p>
            <div className="announcement-history__meta">
              <span>{KIND_LABELS[revision.kind] || revision.kind}</span>
              <span>Priority {revision.priority}</span>
              <span>{revision.creator?.name || 'Hệ thống'}</span>
              <span>{formatDate(revision.created_at)}</span>
            </div>
            <div className="announcement-history__surfaces">
              {revision.surfaces.map((surface) => (
                <Tag key={surface}>{SURFACE_LABELS[surface] || surface}</Tag>
              ))}
            </div>
          </article>
        ),
      }))}
    />
  )
}

export function AuditHistory({ events = [] }) {
  if (!events.length) return <Empty description="Chưa có sự kiện audit" />
  return (
    <Timeline
      className="announcement-history"
      items={events.map((event) => ({
        color: 'blue',
        icon: <ClockCircleOutlined />,
        content: (
          <article className="announcement-history__entry">
            <header>
              <strong>{AUDIT_LABELS[event.action] || event.action}</strong>
              <Tag>{event.source || 'admin'}</Tag>
            </header>
            <div className="announcement-history__meta">
              <span>{event.actor?.name || 'Hệ thống/CLI'}</span>
              <span>{formatDate(event.created_at)}</span>
            </div>
            {Object.keys(event.payload || {}).length > 0 && (
              <dl className="announcement-history__payload">
                {Object.entries(event.payload).map(([key, value]) => (
                  <div key={key}>
                    <dt>{key}</dt>
                    <dd>{typeof value === 'object' ? JSON.stringify(value) : String(value)}</dd>
                  </div>
                ))}
              </dl>
            )}
          </article>
        ),
      }))}
    />
  )
}
