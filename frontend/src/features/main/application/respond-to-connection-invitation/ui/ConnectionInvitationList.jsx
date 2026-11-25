import { MessageOutlined } from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Alert, Button, Skeleton, Tag, Tooltip } from 'antd'
import { Link } from 'react-router'
import {
  applicationKeys,
  getMyConnectionInvitations,
  respondToConnectionInvitation,
} from '@/entities/application/application'
import { CompanyLogo, companyDetailPath } from '@/entities/company/company'
import { jobDetailPath } from '@/entities/job/job'
import { getApiErrorMessage } from '@/shared/api/error-mapper'
import { m } from '@/shared/config/i18n'
import { formatDateTime } from '@/shared/lib/date-time'
import { message } from '@/shared/lib/toast'
import useConfirmAction from '@/shared/ui/confirm-action/use-confirm-action'
import { MascotEmpty } from '@/shared/ui/mascot'

const STATUS_TAGS = {
  accepted: { color: 'success', label: m.candidate_connections_status_accepted },
  declined: { color: 'default', label: m.candidate_connections_status_declined },
}

function InvitationActions({ invitation, pending, onRespond }) {
  if (invitation.status === 'accepted') {
    // Nhắn tin realtime NTD–ứng viên sẽ làm sau; nút giữ chỗ cho lời mời đã đồng ý.
    return (
      <Tooltip title={m.candidate_connections_message_soon()}>
        <Button icon={<MessageOutlined />} disabled>{m.candidate_connections_message()}</Button>
      </Tooltip>
    )
  }
  if (invitation.status !== 'pending') return null
  return (
    <div className="flex gap-2">
      <Button disabled={pending} onClick={() => onRespond(invitation, false)}>
        {m.candidate_connections_decline()}
      </Button>
      <Button type="primary" loading={pending} onClick={() => onRespond(invitation, true)}>
        {m.candidate_connections_accept()}
      </Button>
    </div>
  )
}

/** Lời mời kết nối NTD gửi từ Tìm CV: ứng viên đồng ý (NTD nhắn tin được) hoặc từ chối. */
export default function ConnectionInvitationList() {
  const queryClient = useQueryClient()
  const { confirmationModal, requestConfirmation } = useConfirmAction()
  const query = useQuery({ queryKey: applicationKeys.myConnectionInvitations, queryFn: getMyConnectionInvitations })
  const mutation = useMutation({
    mutationFn: ({ invitation, accept }) => respondToConnectionInvitation(invitation.public_id, accept),
    onSuccess: (updated, { accept }) => {
      queryClient.setQueryData(applicationKeys.myConnectionInvitations, (current) => (
        current?.map((item) => (item.public_id === updated.public_id ? updated : item))
      ))
      message.success(accept ? m.candidate_connections_accepted_toast() : m.candidate_connections_declined_toast())
    },
    onError: (error) => {
      queryClient.invalidateQueries({ queryKey: applicationKeys.myConnectionInvitations })
      message.error(getApiErrorMessage(error, m.candidate_connections_respond_failed()))
    },
  })

  function respond(invitation, accept) {
    if (accept) {
      mutation.mutate({ invitation, accept })
      return
    }
    requestConfirmation({
      title: m.candidate_connections_decline_title(),
      description: m.candidate_connections_decline_text({ company: invitation.company_name, job: invitation.job_title }),
      confirmText: m.candidate_connections_decline(),
      danger: true,
      onConfirm: () => mutation.mutateAsync({ invitation, accept }),
    })
  }

  if (query.isPending) return <Skeleton active paragraph={{ rows: 4 }} className="px-5 py-6 sm:px-6" />
  if (query.isError) return <Alert showIcon type="error" className="!mx-5 !my-6 sm:!mx-6" title={m.candidate_connections_load_failed()} />
  const invitations = query.data || []
  if (!invitations.length) {
    return <MascotEmpty className="py-10 sm:py-14" scene="emptyStateCv" description={m.candidate_connections_empty()} />
  }
  return (
    <ul className="space-y-3 px-5 py-5 sm:px-6">
      {invitations.map((invitation) => {
        const tag = STATUS_TAGS[invitation.status]
        const company = { company_name: invitation.company_name, logo_url: invitation.company_logo_url }
        return (
          <li key={invitation.public_id} className="flex flex-col gap-3 rounded-xl border border-slate-200 p-4 sm:flex-row sm:items-center">
            <div className="flex min-w-0 flex-1 gap-3">
              <CompanyLogo company={company} width={48} height={48} className="h-12 w-12 rounded-lg text-lg" />
              <div className="min-w-0">
                <p className="text-sm leading-5 text-slate-600">
                  <Link to={companyDetailPath(invitation.company_slug)} className="font-bold !text-slate-800 hover:!text-[var(--brand-primary)]">
                    {invitation.company_name}
                  </Link>{' '}
                  {m.candidate_connections_wants_to_connect()}{' '}
                  <Link to={jobDetailPath({ slug: invitation.job_slug })} className="font-semibold !text-[var(--brand-primary)] hover:underline">
                    {invitation.job_title}
                  </Link>
                </p>
                <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-400">
                  <span>{formatDateTime(invitation.invited_at)}</span>
                  {invitation.job_stopped_at && <span>· {m.candidate_connections_job_stopped()}</span>}
                  {tag && <Tag color={tag.color} className="!m-0">{tag.label()}</Tag>}
                </p>
              </div>
            </div>
            <InvitationActions
              invitation={invitation}
              pending={mutation.isPending && mutation.variables?.invitation.public_id === invitation.public_id}
              onRespond={respond}
            />
          </li>
        )
      })}
      {confirmationModal}
    </ul>
  )
}
