import { HistoryOutlined, TeamOutlined } from '@ant-design/icons'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Alert, Avatar, Button, Empty, Segmented, Skeleton } from 'antd'
import { useState } from 'react'
import {
  employerCompanyPageKeys,
  grantEmployerCompanyPageEditor,
  revokeEmployerCompanyPageEditor,
} from '@/entities/company/employer-company-page'
import {
  employerProfileKeys,
  getCompanyMembers,
  getFormerCompanyMembers,
  handOverCompanyResources,
  removeCompanyMember,
  transferCompanyOwnership,
} from '@/entities/account/employer-profile'
import { getApiErrorMessage } from '@/shared/api/error-mapper'
import { m } from '@/shared/config/i18n'
import { formatDateTime } from '@/shared/lib/date-time'
import { message } from '@/shared/lib/toast'
import useConfirmAction from '@/shared/ui/confirm-action/use-confirm-action'
import CompanyJoinRequestsPanel from './CompanyJoinRequestsPanel'
import CompanyMemberCard from './CompanyMemberCard'
import HandoverModal from './HandoverModal'

const FILTERS = [
  { value: 'all', label: m.employer_company_members_filter_all() },
  { value: 'verified', label: m.employer_company_verified() },
  { value: 'unverified', label: m.employer_company_unverified() },
]

/**
 * The company manager's tab: approve who joins ("duyệt tham gia"), then manage
 * every member — their own account verification, recruiting activity, page
 * editing right, the manager role and removal.
 */
export default function CompanyMembersPanel({ onRefresh }) {
  const queryClient = useQueryClient()
  const [filter, setFilter] = useState('all')
  const [handoverSource, setHandoverSource] = useState(null)
  const { confirmationModal, requestConfirmation } = useConfirmAction()
  const membersQuery = useQuery({
    queryKey: employerProfileKeys.companyMembers,
    queryFn: ({ signal }) => getCompanyMembers({ signal }),
    retry: false,
  })
  const formerQuery = useQuery({
    queryKey: employerProfileKeys.formerCompanyMembers,
    queryFn: ({ signal }) => getFormerCompanyMembers({ signal }),
    retry: false,
  })
  const refreshMembers = () => Promise.all([
    queryClient.invalidateQueries({ queryKey: employerProfileKeys.companyMembers }),
    queryClient.invalidateQueries({ queryKey: employerCompanyPageKeys.editors }),
    queryClient.invalidateQueries({ queryKey: employerProfileKeys.formerCompanyMembers }),
  ])
  const action = useMutation({
    mutationFn: ({ run }) => run(),
    onSuccess: async (_result, { done, refreshProfile }) => {
      message.success(done)
      await (refreshProfile ? onRefresh?.() : refreshMembers())
    },
    onError: (error) => message.error(getApiErrorMessage(error, m.employer_company_members_action_failed())),
  })

  const members = membersQuery.data || []
  const verified = members.filter((member) => member.is_verified).length
  const shown = members.filter((member) => (
    filter === 'all' || (filter === 'verified') === member.is_verified
  ))

  const transfer = (member) => requestConfirmation({
    title: m.employer_company_member_transfer(),
    description: m.employer_company_members_transfer_description({ name: member.display_name }),
    confirmText: m.employer_company_members_transfer_confirm(),
    danger: true,
    onConfirm: () => action.mutateAsync({
      member: member.member_id,
      run: () => transferCompanyOwnership(member.member_id),
      done: m.employer_company_members_transfer_done(),
      refreshProfile: true,
    }),
  })
  const toggleEditor = (member) => action.mutate({
    member: member.member_id,
    run: () => (member.page_editor_grant_id
      ? revokeEmployerCompanyPageEditor(member.page_editor_grant_id)
      : grantEmployerCompanyPageEditor(member.member_id)),
    done: member.page_editor_grant_id ? m.employer_company_members_editor_revoked() : m.employer_company_members_editor_granted(),
  })
  const handOver = (source, target) => action.mutateAsync({
    member: source.member_id,
    run: () => handOverCompanyResources(source.member_id, target),
    done: m.employer_company_members_handover_done({ name: source.display_name }),
  }).then(() => setHandoverSource(null), () => {})
  const former = formerQuery.data || []
  const remove = (member, reason) => action.mutateAsync({
    member: member.member_id,
    run: () => removeCompanyMember(member.member_id, reason),
    done: m.employer_company_members_removed({ name: member.display_name }),
  })

  return (
    <div className="company-members">
      <CompanyJoinRequestsPanel onDecided={refreshMembers} />

      <section className="company-members__section" aria-label={m.employer_company_members_title()}>
        <header className="company-members__header">
          <div>
            <h2><TeamOutlined /> {m.employer_company_members_title()}</h2>
            {membersQuery.isSuccess && (
              <p>{m.employer_company_members_summary({ count: members.length, verified })}</p>
            )}
          </div>
          {members.length > 1 && <Segmented size="small" value={filter} onChange={setFilter} options={FILTERS} />}
        </header>
        <p className="company-members__hint">
          {m.employer_company_members_hint()}
        </p>
        {membersQuery.isLoading && <Skeleton active avatar paragraph={{ rows: 3 }} />}
        {membersQuery.isError && (
          <Alert type="warning" showIcon title={getApiErrorMessage(membersQuery.error, m.employer_company_members_verify_required())} />
        )}
        {membersQuery.isSuccess && !shown.length && (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={m.employer_company_members_empty()} />
        )}
        <div className="company-members__list">
          {shown.map((member) => (
            <CompanyMemberCard
              key={member.member_id}
              member={member}
              busy={action.isPending && action.variables?.member === member.member_id}
              onTransfer={transfer}
              onToggleEditor={toggleEditor}
              onHandover={setHandoverSource}
              onRemove={remove}
            />
          ))}
        </div>
      </section>

      {former.length > 0 && (
        <section className="company-members__section" aria-label={m.employer_company_former_title()}>
          <header className="company-members__header">
            <div>
              <h2><HistoryOutlined /> {m.employer_company_former_title()}</h2>
              <p>{m.employer_company_former_hint()}</p>
            </div>
          </header>
          <ul className="company-join-requests">
            {former.map((person) => (
              <li key={person.member_id} className="company-join-request">
                <Avatar size={40} src={person.avatar_url || undefined} className="company-member__avatar">
                  {!person.avatar_url && person.display_name.charAt(0).toLocaleUpperCase('vi-VN')}
                </Avatar>
                <span className="company-join-request__info">
                  <strong>{person.display_name}</strong>
                  <span>
                    {m.employer_company_former_workload({ jobs: person.job_count, active: person.active_job_count, unanswered: person.unanswered_application_count })}
                    {person.open_campaign_count > 0 && ` · ${m.employer_company_former_campaigns({ count: person.open_campaign_count })}`}
                  </span>
                  {person.left_at && <small>{m.employer_company_former_left({ date: formatDateTime(person.left_at) })}</small>}
                </span>
                <span className="company-join-request__actions">
                  <Button type="primary" onClick={() => setHandoverSource(person)}>{m.employer_company_former_take_over()}</Button>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
      <HandoverModal
        source={handoverSource}
        members={members}
        busy={action.isPending}
        onConfirm={handOver}
        onClose={() => setHandoverSource(null)}
      />
      {confirmationModal}
    </div>
  )
}
