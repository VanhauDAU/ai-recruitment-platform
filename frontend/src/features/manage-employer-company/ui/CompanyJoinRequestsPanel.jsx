import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Button, Empty, Skeleton } from 'antd'
import dayjs from 'dayjs'
import {
  decideCompanyJoinRequest,
  employerProfileKeys,
  getCompanyJoinRequests,
} from '@/entities/employer-profile'
import { getApiErrorMessage } from '@/shared/api/error-mapper'
import { message } from '@/shared/lib/toast'

/** Owner view: recruiters asking to join the company, each approved or rejected. */
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
      message.success(decision === 'approve' ? 'Đã thêm thành viên vào công ty.' : 'Đã từ chối yêu cầu.')
    },
    onError: (error) => message.error(getApiErrorMessage(error, 'Không thể xử lý yêu cầu lúc này.')),
  })
  const requests = Array.isArray(requestsQuery.data) ? requestsQuery.data : []

  return (
    <section className="company-update-request" aria-label="Yêu cầu tham gia công ty">
      <div className="w-full">
        <h2>Yêu cầu tham gia công ty</h2>
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
                  loading={decide.isPending && decide.variables?.publicId === item.public_id && decide.variables?.decision === 'approve'}
                  onClick={() => decide.mutate({ publicId: item.public_id, decision: 'approve' })}
                >
                  Duyệt
                </Button>
                <Button
                  size="small"
                  danger
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
