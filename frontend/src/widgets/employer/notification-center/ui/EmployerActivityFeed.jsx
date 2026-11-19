import { HistoryOutlined, ReloadOutlined } from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import { Button, Empty, Pagination, Result, Skeleton, Timeline } from 'antd'
import { useState } from 'react'
import {
  employerNotificationKeys,
  getEmployerActivities,
} from '@/entities/notification/employer-notification'
import { formatDateTime } from '@/shared/lib/date-time'
import { m } from '@/shared/config/i18n'

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
          <time className="text-[11px] font-medium text-slate-400" dateTime={activity.occurred_at}>{formatDateTime(activity.occurred_at)}</time>
        </div>
        <p className="mt-1 text-xs text-slate-500">{m.employer_workspace_activity_actor({ name: activity.actor_name })}</p>
      </article>
    ),
  }))

  return (
    <section className="mt-5 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6" aria-labelledby="employer-activity-title">
      <header className="mb-6">
        <h1 id="employer-activity-title" className="text-lg font-extrabold text-slate-900">{m.employer_workspace_title_activities()}</h1>
        <p className="mt-1 text-xs text-slate-500">{m.employer_workspace_activity_description()}</p>
      </header>
      {query.isPending && <Skeleton active paragraph={{ rows: 6 }} />}
      {query.isError && <Result status="error" title={m.employer_workspace_activity_load_error()} extra={<Button icon={<ReloadOutlined />} onClick={() => query.refetch()}>{m.employer_workspace_retry()}</Button>} />}
      {!query.isPending && !query.isError && activities.length === 0 && <Empty description={m.employer_workspace_activity_empty()} className="py-12" />}
      {activities.length > 0 && <Timeline items={timelineItems} />}
      {(query.data?.count || 0) > 0 && (
        <div className="flex justify-center border-t border-slate-100 pt-4">
          <Pagination current={page} total={query.data.count} pageSize={20} showSizeChanger={false} onChange={setPage} />
        </div>
      )}
    </section>
  )
}
