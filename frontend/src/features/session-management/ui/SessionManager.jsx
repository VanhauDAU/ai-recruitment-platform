import { DesktopOutlined, EnvironmentOutlined } from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { App, Button, Empty, Popconfirm, Skeleton, Tag } from 'antd'
import { listSessions, revokeOtherSessions, revokeSession } from '../api/session-management.api'

function timeAgo(iso) {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (mins < 1) return 'vừa xong'
  if (mins < 60) return `${mins} phút trước`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours} giờ trước`
  return `${Math.floor(hours / 24)} ngày trước`
}

export default function SessionManager() {
  const { message } = App.useApp()
  const queryClient = useQueryClient()
  const { data: sessions = [], isLoading } = useQuery({ queryKey: ['auth-sessions'], queryFn: listSessions })
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['auth-sessions'] })

  const revokeOne = useMutation({
    mutationFn: revokeSession,
    onSuccess: () => { message.success('Đã đăng xuất thiết bị.'); invalidate() },
    onError: () => message.error('Không thể đăng xuất thiết bị này.'),
  })
  const revokeOthers = useMutation({
    mutationFn: revokeOtherSessions,
    onSuccess: () => { message.success('Đã đăng xuất khỏi các thiết bị khác.'); invalidate() },
    onError: () => message.error('Không thể đăng xuất các thiết bị khác.'),
  })

  if (isLoading) return <Skeleton active paragraph={{ rows: 4 }} />

  const hasOthers = sessions.some((session) => !session.current)

  return (
    <div className="max-w-[720px]">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-base font-semibold text-slate-800">Thiết bị đang đăng nhập</h3>
          <p className="text-sm text-slate-500">Các phiên đang hoạt động của tài khoản này. Đăng xuất thiết bị bạn không nhận ra.</p>
        </div>
        {hasOthers && (
          <Popconfirm
            title="Đăng xuất khỏi tất cả thiết bị khác?"
            okText="Đăng xuất" cancelText="Hủy"
            onConfirm={() => revokeOthers.mutate()}
          >
            <Button danger loading={revokeOthers.isPending}>Đăng xuất thiết bị khác</Button>
          </Popconfirm>
        )}
      </div>

      {sessions.length === 0 ? (
        <Empty description="Không có phiên đăng nhập nào." />
      ) : (
        <ul className="space-y-3">
          {sessions.map((session) => (
            <li key={session.id} className="flex items-center justify-between gap-4 rounded-xl border border-slate-100 bg-white p-4 shadow-sm">
              <div className="flex min-w-0 items-start gap-3">
                <DesktopOutlined className="mt-1 text-lg text-slate-400" />
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2 font-semibold text-slate-800">
                    {session.device_label}
                    {session.current && <Tag color="green" className="!m-0">Thiết bị này</Tag>}
                  </div>
                  <div className="mt-0.5 truncate text-sm text-slate-500">
                    {session.ip_address && <span><EnvironmentOutlined /> {session.ip_address} · </span>}
                    Hoạt động {timeAgo(session.last_seen_at)}
                  </div>
                </div>
              </div>
              {!session.current && (
                <Popconfirm
                  title="Đăng xuất thiết bị này?"
                  okText="Đăng xuất" cancelText="Hủy"
                  onConfirm={() => revokeOne.mutate(session.id)}
                >
                  <Button size="small" danger loading={revokeOne.isPending}>Đăng xuất</Button>
                </Popconfirm>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
