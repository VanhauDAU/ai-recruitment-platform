import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Alert, Button, Empty, Skeleton } from 'antd'
import dayjs from 'dayjs'
import {
  decideCompanyJoinRequest,
  employerProfileKeys,
  getCompanyJoinRequests,
} from '@/entities/employer-profile'
import { getApiErrorMessage } from '@/shared/api/error-mapper'
import { message } from '@/shared/lib/toast'

/**
 * Owner view of "duyệt tham gia": recruiters asking to join the company. Only a
 * verified owner decides; joining never verifies the new member's account.
 */
export default function CompanyJoinRequestsPanel() {
  const queryClient = useQueryClient()
  const requestsQuery = useQuery({
    queryKey: employerProfileKeys.companyJoinRequests,
    queryFn: getCompanyJoinRequests,
  })
  const decide = useMutation({
    mutationFn: ({ publicId, decision }) => decideCompanyJoinRequest(publicId, decision),
    onSuccess: (_saved, { decision }) => {
      queryClient.invalidateQueries({ queryKey: employerProfileKeys.companyJoinRequests })
      message.success(decision === 'approve' ? 'Đã duyệt tham gia. Thành viên mới cần tự xác thực tài khoản.' : 'Đã từ chối yêu cầu.')
    },
    onError: (error) => message.error(getApiErrorMessage(error, 'Không thể xử lý yêu cầu lúc này.')),
  })
  const requests = Array.isArray(requestsQuery.data) ? requestsQuery.data : []
  const canDecide = requests.every((item) => item.can_decide)

  return (
    <section className="company-update-request" aria-label="Duyệt tham gia công ty">
      <div className="w-full">
        <h2>Duyệt tham gia công ty</h2>
        {!canDecide && (
          <Alert
            className="my-2"
            type="warning"
            showIcon
            title="Bạn cần xác thực tài khoản trước khi duyệt yêu cầu tham gia."
          />
        )}
        {requestsQuery.isLoading && <Skeleton active paragraph={{ rows: 1 }} />}
        {!requestsQuery.isLoading && !requests.length && (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Chưa có yêu cầu nào đang chờ" />
        )}
        <ul className="m-0 list-none space-y-2 p-0">
          {requests.map((item) => (
            <li key={item.public_id} className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-2">
              <span className="min-w-0">
                <strong className="block truncate text-sm text-slate-800">{item.requester_name}</strong>
                <span className="block truncate text-xs text-slate-500">
                  {[item.requester_email, item.requester_position, dayjs(item.created_at).format('DD/MM/YYYY')].filter(Boolean).join(' · ')}
                </span>
              </span>
              <span className="flex gap-2">
                <Button
                  size="small"
                  type="primary"
                  disabled={!item.can_decide}
                  loading={decide.isPending && decide.variables?.publicId === item.public_id && decide.variables?.decision === 'approve'}
                  onClick={() => decide.mutate({ publicId: item.public_id, decision: 'approve' })}
                >
                  Duyệt
                </Button>
                <Button
                  size="small"
                  danger
                  disabled={!item.can_decide}
                  loading={decide.isPending && decide.variables?.publicId === item.public_id && decide.variables?.decision === 'reject'}
                  onClick={() => decide.mutate({ publicId: item.public_id, decision: 'reject' })}
                >
                  Từ chối
                </Button>
              </span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
