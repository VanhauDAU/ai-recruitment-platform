import { CheckOutlined, ReloadOutlined } from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Button, Empty, Pagination, Result, Skeleton } from 'antd'
import { useState } from 'react'
import {
  employerNotificationKeys,
  getEmployerNotifications,
  markAllEmployerNotificationsRead,
  markEmployerNotificationRead,
} from '@/entities/employer-notification'
import NotificationItem from './NotificationItem'

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
          <h1 id="employer-notifications-title" className="text-lg font-extrabold text-slate-900">Thông báo hệ thống</h1>
          <p className="mt-1 text-xs text-slate-500">Cập nhật xác thực và các thay đổi quan trọng của tài khoản.</p>
        </div>
        <Button icon={<CheckOutlined />} loading={readAllMutation.isPending} onClick={() => readAllMutation.mutate()} disabled={!items.some((item) => !item.is_read)}>
          Đánh dấu tất cả đã đọc
        </Button>
      </header>
      {query.isPending && <div className="p-6"><Skeleton active paragraph={{ rows: 6 }} /></div>}
      {query.isError && <Result status="error" title="Không tải được thông báo" extra={<Button icon={<ReloadOutlined />} onClick={() => query.refetch()}>Thử lại</Button>} />}
      {!query.isPending && !query.isError && items.length === 0 && <Empty description="Chưa có thông báo" className="py-16" />}
      {items.map((item) => <NotificationItem key={item.public_id} item={item} onOpen={(value) => !value.is_read && readMutation.mutate(value.public_id)} />)}
      {(query.data?.count || 0) > 0 && (
        <div className="flex justify-center border-t border-slate-100 p-4">
          <Pagination current={page} total={query.data.count} pageSize={20} showSizeChanger={false} onChange={setPage} />
        </div>
      )}
    </section>
  )
}
