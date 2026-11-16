import { CheckOutlined, CloseOutlined, UserAddOutlined } from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Alert, Avatar, Badge, Button, Skeleton } from 'antd'
import dayjs from 'dayjs'
import {
  decideCompanyJoinRequest,
  employerProfileKeys,
  getCompanyJoinRequests,
} from '@/entities/employer-profile'
import { getApiErrorMessage } from '@/shared/api/error-mapper'
import { message } from '@/shared/lib/toast'
import useConfirmAction from '@/shared/ui/use-confirm-action'

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
        ? 'Đã duyệt tham gia. Thành viên mới cần tự xác thực tài khoản.'
        : 'Đã từ chối yêu cầu tham gia.')
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: employerProfileKeys.companyJoinRequests }),
        onDecided?.(),
      ])
    },
    onError: (error) => message.error(getApiErrorMessage(error, 'Không thể xử lý yêu cầu lúc này.')),
  })
  const requests = Array.isArray(requestsQuery.data) ? requestsQuery.data : []
  const canDecide = requests.every((item) => item.can_decide)
  const busy = (item, decision) => decide.isPending
    && decide.variables?.publicId === item.public_id
    && decide.variables?.decision === decision

  const reject = (item) => requestConfirmation({
    title: 'Từ chối yêu cầu tham gia',
    description: `${item.requester_name} sẽ nhận thông báo yêu cầu không được chấp nhận và có thể xin tham gia công ty khác.`,
    confirmText: 'Từ chối',
    danger: true,
    onConfirm: () => decide.mutateAsync({ publicId: item.public_id, decision: 'reject' }),
  })

  return (
    <section className="company-members__section" aria-label="Duyệt tham gia công ty">
      <header className="company-members__header">
        <div>
          <h2><UserAddOutlined /> Duyệt tham gia công ty <Badge count={requests.length} size="small" /></h2>
          <p>Nhà tuyển dụng xin vào công ty. Duyệt xong họ là thành viên và tự nộp giấy tờ để được xác thực.</p>
        </div>
      </header>
      {!canDecide && (
        <Alert className="mb-3" type="warning" showIcon title="Bạn cần xác thực tài khoản trước khi duyệt yêu cầu tham gia." />
      )}
      {requestsQuery.isLoading && <Skeleton active avatar paragraph={{ rows: 1 }} />}
      {!requestsQuery.isLoading && !requests.length && (
        <p className="company-members__empty">Không có yêu cầu nào đang chờ duyệt.</p>
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
              <small>Gửi {dayjs(item.created_at).format('HH:mm DD/MM/YYYY')}</small>
            </span>
            <span className="company-join-request__actions">
              <Button
                type="primary"
                icon={<CheckOutlined />}
                disabled={!item.can_decide}
                loading={busy(item, 'approve')}
                onClick={() => decide.mutate({ publicId: item.public_id, decision: 'approve' })}
              >
                Duyệt
              </Button>
              <Button
                danger
                icon={<CloseOutlined />}
                disabled={!item.can_decide}
                loading={busy(item, 'reject')}
                onClick={() => reject(item)}
              >
                Từ chối
              </Button>
            </span>
          </li>
        ))}
      </ul>
      {confirmationModal}
    </section>
  )
}
