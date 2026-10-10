import { FileProtectOutlined } from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import { Alert, Button } from 'antd'
import { useDeferredValue, useMemo, useState } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router'
import {
  adminEmployerVerificationKeys,
  getAdminCompanyUpdateRequests,
} from '@/entities/admin-employer-verification'
import { getApiErrorMessage } from '@/shared/api/error-mapper'
import { adminPath } from '@/shared/config/portals'
import CompanyUpdateFilters from './CompanyUpdateFilters'
import CompanyUpdateQueueTable from './CompanyUpdateQueueTable'

export default function AdminCompanyUpdateQueue() {
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams, setSearchParams] = useSearchParams()
  const requestedPage = Number(searchParams.get('update_page') || 1)
  const page = Number.isInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1
  const ordering = searchParams.get('update_ordering') || '-updated_at'
  const status = searchParams.get('update_status') || 'submitted'
  const [queryText, setQueryText] = useState(searchParams.get('update_q') || '')
  const search = useDeferredValue(queryText.trim())
  const params = useMemo(() => ({
    page,
    status,
    ordering,
    ...(searchParams.get('company') ? { company: searchParams.get('company') } : {}),
    ...(search ? { q: search } : {}),
  }), [ordering, page, search, searchParams, status])
  const query = useQuery({
    queryKey: adminEmployerVerificationKeys.companyUpdates(params),
    queryFn: ({ signal }) => getAdminCompanyUpdateRequests(params, { signal }),
  })
  const companyFilter = searchParams.get('company')
  const data = query.data || { count: 0, results: [] }

  const changeSearch = (event) => {
    const value = event.target.value
    setQueryText(value)
    const next = new URLSearchParams(searchParams)
    if (value.trim()) next.set('update_q', value)
    else next.delete('update_q')
    next.delete('update_page')
    setSearchParams(next)
  }

  const updateQuery = (key, value) => {
    const next = new URLSearchParams(searchParams)
    if (
      value === ''
      || value == null
      || (key === 'update_page' && value === 1)
      || (key === 'update_ordering' && value === '-updated_at')
    ) next.delete(key)
    else next.set(key, String(value))
    if (key !== 'update_page') next.delete('update_page')
    setSearchParams(next)
  }

  return (
    <div className="company-update-queue company-management-tab-content">
      <CompanyUpdateFilters
        companyFilter={companyFilter}
        loading={query.isLoading}
        ordering={ordering}
        status={status}
        queryText={queryText}
        total={data.count}
        onClearCompany={() => updateQuery('company', '')}
        onOrderingChange={(value) => updateQuery('update_ordering', value)}
        onStatusChange={(value) => updateQuery('update_status', value)}
        onSearchChange={changeSearch}
      />

      <div className="company-update-queue__notice">
        <FileProtectOutlined aria-hidden="true" />
        <div>
          <strong>Ưu tiên yêu cầu có thay đổi pháp lý</strong>
          <p>
            Kiểm tra mã số thuế, tên pháp nhân và tài liệu đối chiếu trước khi phê duyệt.
          </p>
        </div>
      </div>

      {query.isError && (
        <Alert
          className="mb-4"
          showIcon
          type="error"
          title="Không thể tải yêu cầu cập nhật công ty"
          description={getApiErrorMessage(query.error)}
          action={<Button onClick={() => query.refetch()}>Thử lại</Button>}
        />
      )}

      <CompanyUpdateQueueTable
        data={data}
        loading={query.isLoading}
        ordering={ordering}
        page={page}
        onOpen={(row) => {
          const detailParams = new URLSearchParams({
            tab: 'verification',
            company_update: row.public_id,
          })
          navigate(
            `${adminPath(`/recruiters/${row.requested_by_public_id}`)}?${detailParams}`,
            {
              state: {
                origin: {
                  pathname: location.pathname,
                  search: location.search,
                  label: 'Yêu cầu cập nhật công ty',
                },
              },
            },
          )
        }}
        onChange={(pagination, _, sorter, extra) => {
          if (extra.action === 'sort') {
            const nextOrdering = sorter.order
              ? `${sorter.order === 'descend' ? '-' : ''}${sorter.columnKey}`
              : '-updated_at'
            updateQuery('update_ordering', nextOrdering)
            return
          }
          updateQuery('update_page', pagination.current)
        }}
      />
    </div>
  )
}
