import { CheckOutlined, CloseOutlined, UserAddOutlined } from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Alert, Avatar, Badge, Button, Skeleton } from 'antd'
import dayjs from '@/shared/lib/dayjs'
import {
  decideCompanyJoinRequest,
  employerProfileKeys,
  getCompanyJoinRequests,
} from '@/entities/account/employer-profile'
import { getApiErrorMessage } from '@/shared/api/error-mapper'
import { m } from '@/shared/config/i18n'
import { message } from '@/shared/lib/toast'
import useConfirmAction from '@/shared/ui/confirm-action/use-confirm-action'

/**
 * "Duyệt tham gia": recruiters asking to join. Only a verified company manager
 * decides; joining never verifies the new member's account.
 */
export default function CompanyJoinRequestsPanel({ onDecided }) {
  const queryClient = useQueryClient()
  const { confirmationModal, requestConfirmation } = useConfirmAction()
  const requestsQuery = useQuery({
    queryKey: employerProfileKeys.companyJoinRequests,
    queryFn: getCompanyJoinRequests,
  })
  const decide = useMutation({
    mutationFn: ({ publicId, decision }) => decideCompanyJoinRequest(publicId, decision),
    onSuccess: async (_saved, { decision }) => {
      message.success(decision === 'approve'
        ? m.employer_company_join_approved()
        : m.employer_company_join_rejected())
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: employerProfileKeys.companyJoinRequests }),
        onDecided?.(),
      ])
    },
    onError: (error) => message.error(getApiErrorMessage(error, m.employer_company_join_decide_failed())),
  })
  const requests = Array.isArray(requestsQuery.data) ? requestsQuery.data : []
  const canDecide = requests.every((item) => item.can_decide)
  const busy = (item, decision) => decide.isPending
    && decide.variables?.publicId === item.public_id
    && decide.variables?.decision === decision

  const reject = (item) => requestConfirmation({
    title: m.employer_company_join_reject_title(),
    description: m.employer_company_join_reject_description({ name: item.requester_name }),
    confirmText: m.employer_company_reject(),
    danger: true,
    onConfirm: () => decide.mutateAsync({ publicId: item.public_id, decision: 'reject' }),
  })

  return (
    <section className="company-members__section" aria-label={m.employer_company_join_requests_title()}>
      <header className="company-members__header">
        <div>
          <h2><UserAddOutlined /> {m.employer_company_join_requests_title()} <Badge count={requests.length} size="small" /></h2>
          <p>{m.employer_company_join_requests_hint()}</p>
        </div>
      </header>
      {!canDecide && (
        <Alert className="mb-3" type="warning" showIcon title={m.employer_company_join_requests_verify_first()} />
      )}
      {requestsQuery.isLoading && <Skeleton active avatar paragraph={{ rows: 1 }} />}
      {!requestsQuery.isLoading && !requests.length && (
        <p className="company-members__empty">{m.employer_company_join_requests_empty()}</p>
      )}
      <ul className="company-join-requests">
        {requests.map((item) => (
          <li key={item.public_id} className="company-join-request">
            <Avatar size={40} className="company-member__avatar">
              {(item.requester_name || '?').trim().charAt(0).toLocaleUpperCase('vi-VN')}
            </Avatar>
            <span className="company-join-request__info">
              <strong>{item.requester_name}</strong>
              <span>{[item.requester_position, item.requester_email].filter(Boolean).join(' · ')}</span>
              <small>{m.employer_company_join_requests_sent({ time: dayjs(item.created_at).format('HH:mm DD/MM/YYYY') })}</small>
            </span>
            <span className="company-join-request__actions">
              <Button
                type="primary"
                icon={<CheckOutlined />}
                disabled={!item.can_decide}
                loading={busy(item, 'approve')}
                onClick={() => decide.mutate({ publicId: item.public_id, decision: 'approve' })}
              >
                {m.employer_company_approve()}
              </Button>
              <Button
                danger
                icon={<CloseOutlined />}
                disabled={!item.can_decide}
                loading={busy(item, 'reject')}
                onClick={() => reject(item)}
              >
                {m.employer_company_reject()}
              </Button>
            </span>
          </li>
        ))}
      </ul>
      {confirmationModal}
    </section>
  )
}
