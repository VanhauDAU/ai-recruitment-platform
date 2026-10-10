import { HistoryOutlined, SafetyCertificateOutlined } from '@ant-design/icons'
import { Empty, Segmented, Tag, Timeline } from 'antd'
import { useState } from 'react'
import { formatAdminJobDateTime } from '@/entities/admin-job'
import { adminJobEnumLabel } from '../model/detail-presentation'
import AdminJobPanel from './AdminJobPanel'

export default function AdminJobHistory({ job }) {
  const [view, setView] = useState('moderation')
  const moderationEvents = job.moderation_events || []
  const statusHistory = job.status_history || []
  const activeEvents = view === 'moderation' ? moderationEvents : statusHistory

  return (
    <AdminJobPanel
      badge={`${moderationEvents.length + statusHistory.length} sự kiện`}
      description="Đối chiếu quyết định kiểm duyệt và thay đổi trạng thái"
      icon={<HistoryOutlined />}
      title="Lịch sử xử lý"
    >
      <Segmented
        block
        onChange={setView}
        options={[
          { label: `Kiểm duyệt (${moderationEvents.length})`, value: 'moderation' },
          { label: `Trạng thái (${statusHistory.length})`, value: 'status' },
        ]}
        value={view}
      />
      {activeEvents.length ? (
        <Timeline
          className="mt-6"
          items={activeEvents.map((event) => ({
            dot: view === 'moderation' ? <SafetyCertificateOutlined /> : undefined,
            content: view === 'moderation' ? (
              <div>
                <p className="font-medium text-slate-900">{event.action_label}</p>
                <p className="text-xs text-slate-500">
                  {event.actor_email || 'Hệ thống'} · {formatAdminJobDateTime(event.created_at)}
                </p>
                {event.reason_label && <Tag className="mt-2">{event.reason_label}</Tag>}
                {event.note && <p className="mt-2 text-sm text-slate-600">{event.note}</p>}
              </div>
            ) : (
              <div>
                <p className="font-medium text-slate-900">
                  {event.from_status ? adminJobEnumLabel(event.from_status) : 'Khởi tạo'} → {adminJobEnumLabel(event.to_status)}
                </p>
                <p className="text-xs text-slate-500">
                  {event.changed_by_email || event.actor_role_label} · {formatAdminJobDateTime(event.created_at)}
                </p>
                {event.note && <p className="mt-1 text-sm text-slate-600">{event.note}</p>}
              </div>
            ),
          }))}
        />
      ) : (
        <Empty className="mt-5" description="Chưa có sự kiện" image={Empty.PRESENTED_IMAGE_SIMPLE} />
      )}
    </AdminJobPanel>
  )
}

