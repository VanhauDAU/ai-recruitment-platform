import { formatAdminDate } from '@/entities/account/admin-account'
import { AccountStatusTag } from './AccountStatusTag'
import { CompanyCell, NextActionCell, VerificationCell } from './RecruiterCells'

/**
 * Recruiter columns, most decision-relevant first so they stay visible without
 * horizontal scrolling; every data column sorts on the server.
 */
export function buildRecruiterColumns({ identity, ordering, originState, renderIdentity, sortOrder }) {
  return [
    {
      ...identity,
      width: 220,
      render: (_, row) => renderIdentity(row, [
        row.context?.position_title,
        row.context?.company_role_label,
        `Tham gia ${formatAdminDate(row.date_joined)}`,
      ].filter(Boolean).join(' · ')),
    },
    {
      title: 'Việc cần làm',
      key: 'next_action',
      width: 190,
      sorter: true,
      sortOrder: sortOrder(ordering, 'next_action'),
      render: (_, row) => <NextActionCell row={row} originState={originState} />,
    },
    {
      title: 'Xác thực',
      key: 'recruiter_profile__verification_case__status',
      width: 150,
      sorter: true,
      sortOrder: sortOrder(ordering, 'recruiter_profile__verification_case__status'),
      render: (_, row) => <VerificationCell verification={row.context?.verification} />,
    },
    {
      title: 'Công ty',
      key: 'recruiter_profile__company__company_name',
      width: 170,
      sorter: true,
      sortOrder: sortOrder(ordering, 'recruiter_profile__company__company_name'),
      render: (_, row) => <CompanyCell company={row.context?.company} />,
    },
    {
      title: 'Tài khoản',
      dataIndex: 'status',
      key: 'status',
      width: 150,
      sorter: true,
      sortOrder: sortOrder(ordering, 'status'),
      render: (status, row) => (
        <span className="recruiter-cell">
          <AccountStatusTag status={status} />
          <span className="recruiter-cell__sub">
            {row.last_activity_at ? `Hoạt động ${formatAdminDate(row.last_activity_at)}` : 'Chưa hoạt động'}
          </span>
        </span>
      ),
    },
  ]
}
