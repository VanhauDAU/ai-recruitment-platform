import { DesktopOutlined, EnvironmentOutlined } from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Button, Empty, Skeleton, Tag } from 'antd'
import { listSessions, revokeOtherSessions, revokeSession } from '../api/session-management.api'
import { groupSessions } from '../model/group-sessions'
import { message } from '@/shared/lib/toast'
import ConfirmAction from '@/shared/ui/confirm-action/ConfirmAction'
import { m } from '@/shared/config/i18n'

function timeAgo(iso) {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (mins < 1) return m.account_sessions_just_now()
  if (mins < 60) return m.account_sessions_minutes_ago({ count: mins })
  const hours = Math.floor(mins / 60)
  if (hours < 24) return m.account_sessions_hours_ago({ count: hours })
  return m.account_sessions_days_ago({ count: Math.floor(hours / 24) })
}

export default function SessionManager() {
  const queryClient = useQueryClient()
  const { data, isLoading } = useQuery({ queryKey: ['auth-sessions'], queryFn: listSessions })
  const sessions = groupSessions(Array.isArray(data) ? data : [])
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['auth-sessions'] })

  const revokeOne = useMutation({
    mutationFn: revokeSession,
    onSuccess: () => { message.success(m.account_sessions_revoked()); invalidate() },
    onError: () => message.error(m.account_sessions_revoke_failed()),
  })
  const revokeOthers = useMutation({
    mutationFn: revokeOtherSessions,
    onSuccess: () => { message.success(m.account_sessions_others_revoked()); invalidate() },
    onError: () => message.error(m.account_sessions_others_revoke_failed()),
  })

  if (isLoading) return <Skeleton active paragraph={{ rows: 4 }} />

  const hasOthers = sessions.some((session) => !session.current)

  return (
    <div className="max-w-[720px]">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-base font-semibold text-slate-800">{m.account_sessions_title()}</h3>
          <p className="text-sm text-slate-500">{m.account_sessions_subtitle()}</p>
        </div>
        {hasOthers && (
          <ConfirmAction
            title={m.account_sessions_revoke_others()}
            description={m.account_sessions_revoke_others_desc()}
            confirmText={m.account_sessions_sign_out()}
            danger
            onConfirm={() => revokeOthers.mutateAsync()}
          >
            <Button danger loading={revokeOthers.isPending}>{m.account_sessions_revoke_others()}</Button>
          </ConfirmAction>
        )}
      </div>

      {sessions.length === 0 ? (
        <Empty description={m.account_sessions_empty()} />
      ) : (
        <ul className="space-y-3">
          {sessions.map((session) => (
            <li key={session.id} className="flex items-center justify-between gap-4 rounded-xl border border-slate-100 bg-white p-4 shadow-sm">
              <div className="flex min-w-0 items-start gap-3">
                <DesktopOutlined className="mt-1 text-lg text-slate-400" />
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2 font-semibold text-slate-800">
                    {session.device_label}
                    {session.current && <Tag color="green" className="!m-0">{m.account_sessions_this_device()}</Tag>}
                  </div>
                  <div className="mt-0.5 truncate text-sm text-slate-500">
                    {session.ip_address && <span><EnvironmentOutlined /> {session.ip_address} · </span>}
                    {m.account_sessions_active({ time: timeAgo(session.last_seen_at) })}
                  </div>
                </div>
              </div>
              {!session.current && (
                <ConfirmAction
                  title={m.account_sessions_revoke_title()}
                  description={<>{m.account_sessions_revoke_desc_before()}<strong>{session.device_label}</strong>{m.account_sessions_revoke_desc_after()}</>}
                  confirmText={m.account_sessions_sign_out()}
                  danger
                  onConfirm={() => revokeOne.mutateAsync(session.id)}
                >
                  <Button size="small" danger loading={revokeOne.isPending}>{m.account_sessions_sign_out()}</Button>
                </ConfirmAction>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
