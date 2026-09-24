import { HistoryOutlined, ReloadOutlined } from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import { Button, Empty, Pagination, Result, Skeleton, Timeline } from 'antd'
import { useState } from 'react'
import {
  employerNotificationKeys,
  formatEmployerEventTime,
  getEmployerActivities,
} from '@/entities/employer-notification'

export default function EmployerActivityFeed() {
  const [page, setPage] = useState(1)
  const query = useQuery({
    queryKey: employerNotificationKeys.activityList(page),
    queryFn: () => getEmployerActivities(page),
  })
  const activities = query.data?.results || []
  const timelineItems = activities.map((activity) => ({
    color: 'green',
    icon: <HistoryOutlined className="text-emerald-600" />,
    content: (
      <article className="pb-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <strong className="text-sm text-slate-800">{activity.summary}</strong>
          <time className="text-[11px] font-medium text-slate-400" dateTime={activity.occurred_at}>{formatEmployerEventTime(activity.occurred_at)}</time>
        </div>
        <p className="mt-1 text-xs text-slate-500">Thực hiện bởi: {activity.actor_name}</p>
      </article>
    ),
  }))

  return (
    <section className="mt-5 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6" aria-labelledby="employer-activity-title">
      <header className="mb-6">
        <h1 id="employer-activity-title" className="text-lg font-extrabold text-slate-900">Lịch sử hoạt động</h1>
        <p className="mt-1 text-xs text-slate-500">Nhật ký các thay đổi nghiệp vụ quan trọng của tài khoản nhà tuyển dụng.</p>
      </header>
      {query.isPending && <Skeleton active paragraph={{ rows: 6 }} />}
      {query.isError && <Result status="error" title="Không tải được lịch sử" extra={<Button icon={<ReloadOutlined />} onClick={() => query.refetch()}>Thử lại</Button>} />}
      {!query.isPending && !query.isError && activities.length === 0 && <Empty description="Chưa có hoạt động" className="py-12" />}
      {activities.length > 0 && <Timeline items={timelineItems} />}
      {(query.data?.count || 0) > 0 && (
        <div className="flex justify-center border-t border-slate-100 pt-4">
          <Pagination current={page} total={query.data.count} pageSize={20} showSizeChanger={false} onChange={setPage} />
        </div>
      )}
    </section>
  )
}
