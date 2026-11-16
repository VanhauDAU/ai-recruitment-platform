import { TeamOutlined } from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Alert, Empty, Segmented, Skeleton } from 'antd'
import { useState } from 'react'
import {
  employerCompanyPageKeys,
  grantEmployerCompanyPageEditor,
  revokeEmployerCompanyPageEditor,
} from '@/entities/employer-company-page'
import {
  employerProfileKeys,
  getCompanyMembers,
  removeCompanyMember,
  transferCompanyOwnership,
} from '@/entities/employer-profile'
import { getApiErrorMessage } from '@/shared/api/error-mapper'
import { message } from '@/shared/lib/toast'
import useConfirmAction from '@/shared/ui/use-confirm-action'
import CompanyJoinRequestsPanel from './CompanyJoinRequestsPanel'
import CompanyMemberCard from './CompanyMemberCard'

const FILTERS = [
  { value: 'all', label: 'Tất cả' },
  { value: 'verified', label: 'Đã xác thực' },
  { value: 'unverified', label: 'Chưa xác thực' },
]

/**
 * The company manager's tab: approve who joins ("duyệt tham gia"), then manage
 * every member — their own account verification, recruiting activity, page
 * editing right, the manager role and removal.
 */
export default function CompanyMembersPanel({ onRefresh }) {
  const queryClient = useQueryClient()
  const [filter, setFilter] = useState('all')
  const { confirmationModal, requestConfirmation } = useConfirmAction()
  const membersQuery = useQuery({
    queryKey: employerProfileKeys.companyMembers,
    queryFn: ({ signal }) => getCompanyMembers({ signal }),
    retry: false,
  })
  const refreshMembers = () => Promise.all([
    queryClient.invalidateQueries({ queryKey: employerProfileKeys.companyMembers }),
    queryClient.invalidateQueries({ queryKey: employerCompanyPageKeys.editors }),
  ])
  const action = useMutation({
    mutationFn: ({ run }) => run(),
    onSuccess: async (_result, { done, refreshProfile }) => {
      message.success(done)
      await (refreshProfile ? onRefresh?.() : refreshMembers())
    },
    onError: (error) => message.error(getApiErrorMessage(error, 'Không thể thực hiện thao tác này.')),
  })

  const members = membersQuery.data || []
  const verified = members.filter((member) => member.is_verified).length
  const shown = members.filter((member) => (
    filter === 'all' || (filter === 'verified') === member.is_verified
  ))

  const transfer = (member) => requestConfirmation({
    title: 'Chuyển quyền quản lý công ty',
    description: `${member.display_name} sẽ trở thành quản lý công ty: duyệt yêu cầu tham gia, quản lý thành viên và trang công ty. Bạn trở thành thành viên.`,
    confirmText: 'Chuyển quyền',
    danger: true,
    onConfirm: () => action.mutateAsync({
      member: member.member_id,
      run: () => transferCompanyOwnership(member.member_id),
      done: 'Đã chuyển quyền quản lý. Bạn hiện là thành viên của công ty.',
      refreshProfile: true,
    }),
  })
  const toggleEditor = (member) => action.mutate({
    member: member.member_id,
    run: () => (member.page_editor_grant_id
      ? revokeEmployerCompanyPageEditor(member.page_editor_grant_id)
      : grantEmployerCompanyPageEditor(member.member_id)),
    done: member.page_editor_grant_id ? 'Đã thu hồi quyền biên tập trang công ty.' : 'Đã cấp quyền biên tập trang công ty.',
  })
  const remove = (member, reason) => action.mutateAsync({
    member: member.member_id,
    run: () => removeCompanyMember(member.member_id, reason),
    done: `Đã gỡ ${member.display_name} khỏi công ty.`,
  })

  return (
    <div className="company-members">
      <CompanyJoinRequestsPanel onDecided={refreshMembers} />

      <section className="company-members__section" aria-label="Thành viên công ty">
        <header className="company-members__header">
          <div>
            <h2><TeamOutlined /> Thành viên công ty</h2>
            {membersQuery.isSuccess && (
              <p>{members.length} thành viên · {verified} đã xác thực tài khoản</p>
            )}
          </div>
          {members.length > 1 && <Segmented size="small" value={filter} onChange={setFilter} options={FILTERS} />}
        </header>
        <p className="company-members__hint">
          Vào công ty xong, mỗi thành viên tự nộp giấy tờ để quản trị viên ProCV xác thực tài khoản. Chỉ thành viên đã xác thực mới được nhận quyền quản lý hoặc biên tập trang công ty.
        </p>
        {membersQuery.isLoading && <Skeleton active avatar paragraph={{ rows: 3 }} />}
        {membersQuery.isError && (
          <Alert type="warning" showIcon title={getApiErrorMessage(membersQuery.error, 'Bạn cần xác thực tài khoản để quản lý thành viên công ty.')} />
        )}
        {membersQuery.isSuccess && !shown.length && (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Không có thành viên phù hợp" />
        )}
        <div className="company-members__list">
          {shown.map((member) => (
            <CompanyMemberCard
              key={member.member_id}
              member={member}
              busy={action.isPending && action.variables?.member === member.member_id}
              onTransfer={transfer}
              onToggleEditor={toggleEditor}
              onRemove={remove}
            />
          ))}
        </div>
      </section>
      {confirmationModal}
    </div>
  )
}
