import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Alert, Button, Empty, Segmented, Table, Tag } from 'antd'
import { useState } from 'react'
import { Link } from 'react-router'
import {
  adminCompanyKeys,
  decideAdminCompanyJoinRequest,
  getAdminCompanyJoinRequests,
} from '@/entities/company/admin-company'
import { getApiErrorMessage } from '@/shared/api/error-mapper'
import { adminPath } from '@/shared/config/portals'
import { message } from '@/shared/lib/toast'
import { CompanyPanel } from './CompanyPanel'
import { formatDateTime } from '@/shared/lib/date-time'

const EMPTY_PAGE = { count: 0, results: [] }

const formatDate = (value) => formatDateTime(value, { dateStyle: 'medium' })

/**
 * "Duyệt tham gia" requests. Owners decide their own company's requests; an
 * administrator decides only those of a company without a verified owner.
 */
export default function AdminCompanyJoinRequestQueue({ companyPublicId }) {
  const queryClient = useQueryClient()
  const [scope, setScope] = useState(companyPublicId ? 'all' : 'awaiting_admin')
  const [page, setPage] = useState(1)
  const params = {
    page,
    ...(companyPublicId && { company: companyPublicId }),
    ...(scope === 'awaiting_admin' && { awaiting_admin: 1 }),
  }
  const query = useQuery({
    queryKey: adminCompanyKeys.joinRequests(params),
    queryFn: ({ signal }) => getAdminCompanyJoinRequests(params, { signal }),
  })
  const decide = useMutation({
    mutationFn: ({ publicId, decision }) => decideAdminCompanyJoinRequest(publicId, decision),
    onSuccess: (_saved, { decision }) => {
      queryClient.invalidateQueries({ queryKey: adminCompanyKeys.all })
      message.success(decision === 'approve' ? 'Đã duyệt tham gia công ty.' : 'Đã từ chối yêu cầu.')
    },
    onError: (error) => message.error(getApiErrorMessage(error, 'Không thể xử lý yêu cầu.')),
  })
  const data = query.data || EMPTY_PAGE
  const busy = (row, decision) => decide.isPending
    && decide.variables?.publicId === row.public_id
    && decide.variables?.decision === decision

  const columns = [
    {
      title: 'Người xin tham gia',
      key: 'requester',
      render: (_, row) => (
        <div className="min-w-0">
          <div className="truncate font-semibold text-slate-900">{row.requester_name}</div>
          <div className="truncate text-xs text-slate-500">{[row.requester_email, row.requester_position].filter(Boolean).join(' · ')}</div>
        </div>
      ),
    },
    !companyPublicId && {
      title: 'Công ty',
      key: 'company',
      render: (_, row) => (
        <Link className="font-medium text-[var(--brand-primary-hover)]" to={adminPath(`/cong-ty/${row.company_public_id}?tab=join-requests`)}>
          {row.company_name}
        </Link>
      ),
    },
    {
      title: 'Người duyệt',
      key: 'reviewer',
      width: 170,
      render: (_, row) => (row.awaiting_admin
        ? <Tag color="orange">Quản trị viên</Tag>
        : <Tag color="blue">Quản lý công ty</Tag>),
    },
    { title: 'Gửi lúc', dataIndex: 'created_at', width: 170, render: formatDate },
    {
      title: '',
      key: 'actions',
      width: 170,
      render: (_, row) => (row.can_decide ? (
        <span className="flex gap-2">
          <Button size="small" type="primary" loading={busy(row, 'approve')} onClick={() => decide.mutate({ publicId: row.public_id, decision: 'approve' })}>
            Duyệt
          </Button>
          <Button size="small" danger loading={busy(row, 'reject')} onClick={() => decide.mutate({ publicId: row.public_id, decision: 'reject' })}>
            Từ chối
          </Button>
        </span>
      ) : <span className="text-xs text-slate-500">Chờ quản lý công ty duyệt</span>),
    },
  ].filter(Boolean)

  return (
    <CompanyPanel
      title="Yêu cầu tham gia công ty"
      description="Duyệt tham gia là việc của quản lý công ty. Quản trị viên chỉ duyệt khi công ty chưa có quản lý đã xác thực tài khoản."
    >
      <Segmented
        className="mb-3"
        value={scope}
        onChange={(value) => { setScope(value); setPage(1) }}
        options={[
          { value: 'awaiting_admin', label: 'Chờ quản trị viên' },
          { value: 'all', label: 'Tất cả đang chờ' },
        ]}
      />
      {query.isError && (
        <Alert className="mb-3" showIcon type="error" title="Không tải được yêu cầu tham gia" description={getApiErrorMessage(query.error)} />
      )}
      <Table
        rowKey="public_id"
        size="small"
        loading={query.isLoading}
        dataSource={data.results}
        columns={columns}
        scroll={{ x: 720 }}
        locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Không có yêu cầu nào" /> }}
        pagination={{ current: page, pageSize: 20, total: data.count, showSizeChanger: false, onChange: setPage }}
      />
    </CompanyPanel>
  )
}
