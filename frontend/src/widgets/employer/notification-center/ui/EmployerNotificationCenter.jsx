import { CheckOutlined, ReloadOutlined } from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Button, Empty, Pagination, Result, Skeleton } from 'antd'
import { useState } from 'react'
import {
  employerNotificationKeys,
  employerNotificationTone,
  getEmployerNotifications,
  markAllEmployerNotificationsRead,
  markEmployerNotificationRead,
} from '@/entities/notification/employer-notification'
import NotificationListItem from '@/shared/ui/NotificationListItem'
import { m } from '@/shared/config/i18n'

export default function EmployerNotificationCenter() {
  const [page, setPage] = useState(1)
  const queryClient = useQueryClient()
  const query = useQuery({
    queryKey: employerNotificationKeys.list(page),
    queryFn: () => getEmployerNotifications(page),
  })
  const invalidate = () => queryClient.invalidateQueries({ queryKey: employerNotificationKeys.all })
  const readMutation = useMutation({ mutationFn: markEmployerNotificationRead, onSuccess: invalidate })
  const readAllMutation = useMutation({ mutationFn: markAllEmployerNotificationsRead, onSuccess: invalidate })
  const items = query.data?.results || []

  return (
    <section className="mt-5 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm" aria-labelledby="employer-notifications-title">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-4 sm:px-6">
        <div>
          <h1 id="employer-notifications-title" className="text-lg font-extrabold text-slate-900">{m.employer_workspace_title_notifications()}</h1>
          <p className="mt-1 text-xs text-slate-500">{m.employer_workspace_notifications_description()}</p>
        </div>
        <Button icon={<CheckOutlined />} loading={readAllMutation.isPending} onClick={() => readAllMutation.mutate()} disabled={!items.some((item) => !item.is_read)}>
          {m.employer_workspace_notifications_mark_all_read()}
        </Button>
      </header>
      {query.isPending && <div className="p-6"><Skeleton active paragraph={{ rows: 6 }} /></div>}
      {query.isError && <Result status="error" title={m.employer_workspace_notifications_load_error()} extra={<Button icon={<ReloadOutlined />} onClick={() => query.refetch()}>{m.employer_workspace_retry()}</Button>} />}
      {!query.isPending && !query.isError && items.length === 0 && <Empty description={m.employer_workspace_notifications_empty()} className="py-16" />}
      {items.map((item) => <NotificationListItem key={item.public_id} item={item} tone={employerNotificationTone(item.event_type)} time={item.created_at} onOpen={(value) => !value.is_read && readMutation.mutate(value.public_id)} />)}
      {(query.data?.count || 0) > 0 && (
        <div className="flex justify-center border-t border-slate-100 p-4">
          <Pagination current={page} total={query.data.count} pageSize={20} showSizeChanger={false} onChange={setPage} />
        </div>
      )}
    </section>
  )
}
