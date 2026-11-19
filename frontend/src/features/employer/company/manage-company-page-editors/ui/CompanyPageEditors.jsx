import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Alert, Button, Empty, Skeleton, Tag } from 'antd'
import {
  employerCompanyPageKeys,
  getEmployerCompanyPageEditors,
  grantEmployerCompanyPageEditor,
  revokeEmployerCompanyPageEditor,
} from '@/entities/company/employer-company-page'
import { getApiErrorMessage } from '@/shared/api/error-mapper'
import { message } from '@/shared/lib/toast'
import ConfirmAction from '@/shared/ui/confirm-action/ConfirmAction'
import './company-page-editors.css'
import { getIntlLocale, m } from '@/shared/config/i18n'

function grantedLabel(grant) {
  const date = grant.granted_at ? new Date(grant.granted_at) : null
  const day = date && !Number.isNaN(date.getTime()) ? date.toLocaleDateString(getIntlLocale()) : ''
  return [m.employer_company_editors_granted(), day && m.employer_company_editors_granted_on({ date: day }), grant.granted_by_name && m.employer_company_editors_granted_by({ name: grant.granted_by_name })]
    .filter(Boolean)
    .join(' ')
}

// `display_name` có thể rỗng: lùi về email đã che.
const memberName = (member) => member.display_name || member.email_masked || m.employer_company_editors_member_fallback()

/** Danh sách thành viên công ty và quyền biên tập trang công ty; chỉ chủ sở hữu đã xác thực dùng được. */
export default function CompanyPageEditors() {
  const queryClient = useQueryClient()
  const query = useQuery({
    queryKey: employerCompanyPageKeys.editors,
    queryFn: ({ signal }) => getEmployerCompanyPageEditors({ signal }),
  })
  const replaceMember = (member) => queryClient.setQueryData(
    employerCompanyPageKeys.editors,
    (rows = []) => rows.map((row) => (row.member_id === member.member_id ? member : row)),
  )
  const failed = (error, fallback) => {
    message.error(getApiErrorMessage(error, fallback))
    // Lỗi thường do trạng thái thành viên đã đổi (hết xác thực, đã được cấp).
    query.refetch()
  }
  const grant = useMutation({
    mutationFn: grantEmployerCompanyPageEditor,
    onSuccess: (member) => {
      replaceMember(member)
      message.success(m.employer_company_editors_grant_done({ name: memberName(member) }))
    },
    onError: (error) => failed(error, m.employer_company_editors_grant_failed()),
  })

  async function revoke(member) {
    replaceMember(await revokeEmployerCompanyPageEditor(member.grant.public_id))
    message.success(m.employer_company_editors_revoke_done({ name: memberName(member) }))
  }

  if (query.isPending) return <Skeleton active paragraph={{ rows: 4 }} />
  if (query.isError) {
    return (
      <Alert
        showIcon
        type="error"
        title={getApiErrorMessage(query.error, m.employer_company_editors_load_error())}
        action={<Button size="small" onClick={() => query.refetch()}>{m.employer_company_retry()}</Button>}
      />
    )
  }
  if (query.data.length === 0) return <Empty description={m.employer_company_editors_empty()} />

  return (
    <div>
      <p className="company-editors__hint">
        {m.employer_company_editors_hint()}
      </p>
      <ul className="company-editors" aria-label={m.employer_company_members_title()}>
        {query.data.map((member) => {
          const owner = member.company_role === 'owner'
          const name = memberName(member)
          return (
            <li key={member.member_id} className="company-editors__row">
              <div className="company-editors__identity">
                <p className="company-editors__name">
                  {name}
                  {owner && <Tag color="gold">{m.employer_company_owner()}</Tag>}
                  {!owner && !member.eligible && <Tag>{m.employer_company_unverified()}</Tag>}
                  {member.grant && (
                    <Tag color={member.grant.effective ? 'green' : 'orange'}>
                      {member.grant.effective ? m.employer_company_editors_grant_active() : m.employer_company_editors_grant_suspended()}
                    </Tag>
                  )}
                </p>
                <p className="company-editors__meta">
                  {[member.position_title, member.display_name && member.email_masked].filter(Boolean).join(' · ')}
                </p>
                {member.grant && <p className="company-editors__meta">{grantedLabel(member.grant)}</p>}
              </div>
              {!owner && (member.grant ? (
                <ConfirmAction
                  danger
                  title={m.employer_company_editors_revoke_title()}
                  description={m.employer_company_editors_revoke_description({ name })}
                  confirmText={m.employer_company_editors_revoke()}
                  onConfirm={() => revoke(member)}
                  onConfirmError={(error) => failed(error, m.employer_company_editors_revoke_failed())}
                >
                  <Button danger size="small" aria-label={m.employer_company_editors_revoke_label({ name })}>{m.employer_company_editors_revoke()}</Button>
                </ConfirmAction>
              ) : (
                <Button
                  size="small"
                  type="primary"
                  ghost
                  disabled={!member.eligible}
                  loading={grant.isPending && grant.variables === member.member_id}
                  aria-label={m.employer_company_editors_grant_label({ name })}
                  onClick={() => grant.mutate(member.member_id)}
                >
                  {m.employer_company_editors_grant()}
                </Button>
              ))}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
