import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Alert, Button, Empty, Skeleton, Tag } from 'antd'
import {
  employerCompanyPageKeys,
  getEmployerCompanyPageEditors,
  grantEmployerCompanyPageEditor,
  revokeEmployerCompanyPageEditor,
} from '@/entities/employer-company-page'
import { getApiErrorMessage } from '@/shared/api/error-mapper'
import { message } from '@/shared/lib/toast'
import ConfirmAction from '@/shared/ui/ConfirmAction'
import './company-page-editors.css'

function grantedLabel(grant) {
  const date = grant.granted_at ? new Date(grant.granted_at) : null
  const day = date && !Number.isNaN(date.getTime()) ? date.toLocaleDateString('vi-VN') : ''
  return ['Cấp quyền', day && `ngày ${day}`, grant.granted_by_name && `bởi ${grant.granted_by_name}`]
    .filter(Boolean)
    .join(' ')
}

// `display_name` có thể rỗng: lùi về email đã che.
const memberName = (member) => member.display_name || member.email_masked || 'Thành viên'

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
      message.success(`Đã cấp quyền biên tập cho ${memberName(member)}.`)
    },
    onError: (error) => failed(error, 'Không thể cấp quyền biên tập.'),
  })

  async function revoke(member) {
    replaceMember(await revokeEmployerCompanyPageEditor(member.grant.public_id))
    message.success(`Đã thu hồi quyền biên tập của ${memberName(member)}.`)
  }

  if (query.isPending) return <Skeleton active paragraph={{ rows: 4 }} />
  if (query.isError) {
    return (
      <Alert
        showIcon
        type="error"
        title={getApiErrorMessage(query.error, 'Không thể tải danh sách thành viên.')}
        action={<Button size="small" onClick={() => query.refetch()}>Thử lại</Button>}
      />
    )
  }
  if (query.data.length === 0) return <Empty description="Công ty chưa có thành viên nào." />

  return (
    <div>
      <p className="company-editors__hint">
        Người biên tập được tuỳ biến bố cục và nội dung trang công ty. Chỉ thành viên đã xác thực mới được cấp quyền.
      </p>
      <ul className="company-editors" aria-label="Thành viên công ty">
        {query.data.map((member) => {
          const owner = member.company_role === 'owner'
          const name = memberName(member)
          return (
            <li key={member.member_id} className="company-editors__row">
              <div className="company-editors__identity">
                <p className="company-editors__name">
                  {name}
                  {owner && <Tag color="gold">Chủ sở hữu</Tag>}
                  {!owner && !member.eligible && <Tag>Chưa xác thực</Tag>}
                  {member.grant && (
                    <Tag color={member.grant.effective ? 'green' : 'orange'}>
                      {member.grant.effective ? 'Đang hiệu lực' : 'Tạm mất hiệu lực'}
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
                  title="Thu hồi quyền biên tập"
                  description={`${name} sẽ không còn tuỳ biến được trang công ty.`}
                  confirmText="Thu hồi"
                  onConfirm={() => revoke(member)}
                  onConfirmError={(error) => failed(error, 'Không thể thu hồi quyền biên tập.')}
                >
                  <Button danger size="small" aria-label={`Thu hồi quyền biên tập của ${name}`}>Thu hồi</Button>
                </ConfirmAction>
              ) : (
                <Button
                  size="small"
                  type="primary"
                  ghost
                  disabled={!member.eligible}
                  loading={grant.isPending && grant.variables === member.member_id}
                  aria-label={`Cấp quyền biên tập cho ${name}`}
                  onClick={() => grant.mutate(member.member_id)}
                >
                  Cấp quyền biên tập
                </Button>
              ))}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
