import { BellOutlined } from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Badge, Button, Empty, Popover, Skeleton } from 'antd'
import { Link } from 'react-router'
import {
  employerNotificationKeys,
  employerNotificationTone,
  getEmployerNotifications,
  getEmployerNotificationUnreadCount,
  markEmployerNotificationRead,
} from '@/entities/notification/employer-notification'
import { employerAppPath } from '@/shared/config/portals'
import NotificationListItem from '@/shared/ui/NotificationListItem'
import { m } from '@/shared/config/i18n'

export default function EmployerNotificationBell() {
  const queryClient = useQueryClient()
  const unreadQuery = useQuery({
    queryKey: employerNotificationKeys.unread(),
    queryFn: getEmployerNotificationUnreadCount,
    refetchInterval: 60_000,
  })
  const listQuery = useQuery({
    queryKey: employerNotificationKeys.list({ page: 1 }),
    queryFn: () => getEmployerNotifications({ page: 1 }),
  })
  const readMutation = useMutation({
    mutationFn: markEmployerNotificationRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: employerNotificationKeys.all })
    },
  })
  const items = listQuery.data?.results?.slice(0, 5) || []
  const content = (
    <div className="w-[min(360px,calc(100vw-24px))] overflow-hidden rounded-xl bg-white">
      <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
        <strong className="text-sm text-slate-800">{m.employer_workspace_notifications_heading()}</strong>
        <Link to={employerAppPath('/notifications')} className="text-xs font-semibold text-emerald-600">{m.employer_workspace_dash_view_all()}</Link>
      </div>
      <div className="max-h-[420px] overflow-y-auto">
        {listQuery.isPending && <div className="p-4"><Skeleton active paragraph={{ rows: 3 }} /></div>}
        {listQuery.isError && <p className="p-5 text-center text-xs text-red-600">{m.employer_workspace_notifications_load_error_short()}</p>}
        {!listQuery.isPending && !listQuery.isError && items.length === 0 && <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={m.employer_workspace_notifications_empty()} className="py-7" />}
        {items.map((item) => <NotificationListItem key={item.public_id} item={item} tone={employerNotificationTone(item.event_type)} time={item.created_at} compact onOpen={(value) => !value.is_read && readMutation.mutate(value.public_id)} />)}
      </div>
    </div>
  )
  return (
    <Popover content={content} trigger="click" placement="bottomRight" styles={{ container: { padding: 0 } }}>
      <Badge count={unreadQuery.data?.count || 0} size="small" overflowCount={99}>
        <Button type="text" shape="circle" aria-label={m.employer_workspace_title_notifications()} icon={<BellOutlined />} className="!text-slate-200 hover:!bg-white/10 hover:!text-white" />
      </Badge>
    </Popover>
  )
}
