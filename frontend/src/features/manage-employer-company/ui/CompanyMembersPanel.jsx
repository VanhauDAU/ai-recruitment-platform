import { useMutation, useQuery } from '@tanstack/react-query'
import { Alert, Button, Empty, Skeleton, Tag } from 'antd'
import { employerCompanyPageKeys, getEmployerCompanyPageEditors } from '@/entities/employer-company-page'
import { transferCompanyOwnership } from '@/entities/employer-profile'
import { getApiErrorMessage } from '@/shared/api/error-mapper'
import { message } from '@/shared/lib/toast'
import ConfirmAction from '@/shared/ui/ConfirmAction'
import CompanyJoinRequestsPanel from './CompanyJoinRequestsPanel'

/**
 * Owner tab: approve who joins ("duyệt tham gia"), see every member with their
 * own account verification, and hand ownership to a verified member.
 */
export default function CompanyMembersPanel({ onRefresh }) {
  const membersQuery = useQuery({
    queryKey: employerCompanyPageKeys.editors,
    queryFn: ({ signal }) => getEmployerCompanyPageEditors({ signal }),
    retry: false,
  })
  const transfer = useMutation({
    mutationFn: (memberId) => transferCompanyOwnership(memberId),
    onSuccess: async () => {
      message.success('Đã chuyển quyền owner. Bạn hiện là thành viên của công ty.')
      await onRefresh?.()
    },
    onError: (error) => message.error(getApiErrorMessage(error, 'Không thể chuyển quyền owner.')),
  })
  const members = membersQuery.data || []

  return (
    <div className="space-y-4">
      <CompanyJoinRequestsPanel />

      <section className="rounded-lg border border-slate-200 p-4" aria-label="Thành viên công ty">
        <div className="w-full">
          <h2 className="m-0 text-base font-bold text-slate-800">Thành viên công ty</h2>
          <p className="mb-2 mt-1 text-xs text-slate-500">
            Mỗi thành viên tự nộp giấy tờ để được quản trị viên xác thực tài khoản. Chỉ chuyển quyền owner được cho thành viên đã xác thực.
          </p>
          {membersQuery.isLoading && <Skeleton active paragraph={{ rows: 2 }} />}
          {membersQuery.isError && (
            <Alert type="warning" showIcon title="Bạn cần xác thực tài khoản để quản lý thành viên công ty." />
          )}
          {membersQuery.isSuccess && !members.length && (
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Công ty chưa có thành viên" />
          )}
          <ul className="m-0 list-none space-y-2 p-0">
            {members.map((row) => (
              <li key={row.member_id} className="flex flex-col gap-2 border-t border-slate-100 pt-2 sm:flex-row sm:items-center sm:justify-between">
                <span className="min-w-0">
                  <strong className="block truncate text-sm text-slate-800">{row.display_name || row.email_masked}</strong>
                  <span className="block truncate text-xs text-slate-500">{[row.email_masked, row.position_title].filter(Boolean).join(' · ')}</span>
                </span>
                <span className="flex flex-wrap items-center gap-2">
                  <Tag color={row.company_role === 'owner' ? 'blue' : 'default'}>{row.company_role === 'owner' ? 'Owner' : 'Thành viên'}</Tag>
                  <Tag color={row.eligible ? 'green' : 'orange'}>{row.eligible ? 'Đã xác thực' : 'Chưa xác thực'}</Tag>
                  {row.company_role === 'member' && row.eligible && (
                    <ConfirmAction
                      title="Chuyển quyền owner"
                      description={`${row.display_name || row.email_masked} sẽ trở thành owner, duyệt yêu cầu tham gia và quản lý trang công ty. Bạn trở thành thành viên.`}
                      confirmText="Chuyển quyền"
                      danger
                      onConfirm={() => transfer.mutateAsync(row.member_id)}
                    >
                      <Button size="small">Chuyển quyền owner</Button>
                    </ConfirmAction>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  )
}
