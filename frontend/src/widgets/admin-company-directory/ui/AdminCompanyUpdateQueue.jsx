import { EyeOutlined, SearchOutlined } from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import { Alert, Button, Input, Table, Tag, Typography } from 'antd'
import { useDeferredValue, useMemo, useState } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router'
import {
  adminEmployerVerificationKeys,
  getAdminCompanyUpdateRequests,
} from '@/entities/admin-employer-verification'
import { getApiErrorMessage } from '@/shared/api/error-mapper'
import { adminPath } from '@/shared/config/portals'

function formatDate(value) {
  if (!value) return 'Chưa gửi'
  return new Intl.DateTimeFormat('vi-VN', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(value))
}

export default function AdminCompanyUpdateQueue() {
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams, setSearchParams] = useSearchParams()
  const requestedPage = Number(searchParams.get('update_page') || 1)
  const page = Number.isInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1
  const ordering = searchParams.get('update_ordering') || '-updated_at'
  const [queryText, setQueryText] = useState(searchParams.get('update_q') || '')
  const search = useDeferredValue(queryText.trim())
  const params = useMemo(() => ({
    page,
    status: 'pending',
    ordering,
    ...(searchParams.get('company') ? { company: searchParams.get('company') } : {}),
    ...(search ? { q: search } : {}),
  }), [ordering, page, search, searchParams])
  const query = useQuery({
    queryKey: adminEmployerVerificationKeys.companyUpdates(params),
    queryFn: ({ signal }) => getAdminCompanyUpdateRequests(params, { signal }),
  })

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
    <div className="space-y-4">
      <div className="company-update-queue-filters">
        <Input
          allowClear
          prefix={<SearchOutlined />}
          placeholder="Email người gửi, tên công ty hoặc MST"
          value={queryText}
          onChange={changeSearch}
        />
      </div>

      <Typography.Title level={5} className="!mb-2 !mt-0">
        Yêu cầu cập nhật thông tin công ty
      </Typography.Title>
      {query.isError && (
        <Alert
          showIcon
          type="error"
          title="Không thể tải yêu cầu cập nhật công ty"
          description={getApiErrorMessage(query.error)}
        />
      )}
      <div className="overflow-x-auto">
        <Table
          rowKey="public_id"
          size="small"
          loading={query.isLoading}
          dataSource={query.data?.results || []}
          scroll={{ x: 820 }}
          pagination={{
            current: page,
            pageSize: 20,
            total: query.data?.count || 0,
            showSizeChanger: false,
            showTotal: (total) => `${total.toLocaleString('vi-VN')} yêu cầu`,
          }}
          columns={[
            {
              title: 'Công ty',
              key: 'company__company_name',
              sorter: true,
              sortOrder: ordering === 'company__company_name'
                ? 'ascend'
                : ordering === '-company__company_name' ? 'descend' : null,
              render: (_, row) => (
                <div>
                  <Typography.Text strong className="!block">{row.company?.name}</Typography.Text>
                  <Typography.Text type="secondary" className="!text-xs">{row.company?.tax_code}</Typography.Text>
                </div>
              ),
            },
            {
              title: 'Người gửi',
              dataIndex: 'requested_by_email',
              key: 'requested_by__email',
              sorter: true,
              sortOrder: ordering === 'requested_by__email'
                ? 'ascend'
                : ordering === '-requested_by__email' ? 'descend' : null,
            },
            {
              title: 'Nội dung sửa',
              dataIndex: 'changes',
              key: 'change_count',
              sorter: true,
              sortOrder: ordering === 'change_count'
                ? 'ascend'
                : ordering === '-change_count' ? 'descend' : null,
              render: (changes) => `${Object.keys(changes || {}).length} trường`,
            },
            {
              title: 'Mức độ',
              dataIndex: 'is_sensitive',
              key: 'is_sensitive',
              sorter: true,
              sortOrder: ordering === 'is_sensitive'
                ? 'ascend'
                : ordering === '-is_sensitive' ? 'descend' : null,
              render: (value) => (
                <Tag color={value ? 'red' : 'blue'}>
                  {value ? 'Pháp lý' : 'Thông thường'}
                </Tag>
              ),
            },
            {
              title: 'Gửi gần nhất',
              dataIndex: 'updated_at',
              key: 'updated_at',
              sorter: true,
              sortOrder: ordering === 'updated_at'
                ? 'ascend'
                : ordering === '-updated_at' ? 'descend' : null,
              render: formatDate,
            },
            {
              title: '',
              key: 'action',
              fixed: 'right',
              width: 120,
              render: (_, row) => (
                <Button
                  type="link"
                  icon={<EyeOutlined />}
                  onClick={() => navigate(
                    `${adminPath(`/recruiters/${row.requested_by_public_id}`)}?tab=verification`,
                    {
                      state: {
                        origin: {
                          pathname: location.pathname,
                          search: location.search,
                          label: 'Yêu cầu cập nhật công ty',
                        },
                      },
                    },
                  )}
                >
                  Xử lý
                </Button>
              ),
            },
          ]}
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
    </div>
  )
}
